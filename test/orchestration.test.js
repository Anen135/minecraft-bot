import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import minecraftData from 'minecraft-data'
import BotManager from '../src/core/BotManager.js'
import InputManager from '../src/inputs/InputManager.js'
import CommandLoader from '../src/commands/CommandLoader.js'
import CommandRegistry from '../src/commands/CommandRegistry.js'
import PerceptionManager from '../src/perception/PerceptionManager.js'
import ConsoleObservationReporter from '../src/perception/ConsoleObservationReporter.js'
import MiningService from '../src/services/MiningService.js'

function application(t, options = {}, configureBot = () => {}) {
    t.mock.method(console, 'log', () => {})
    const source = new PassThrough(), output = new PassThrough()
    const bots = [], replies = [], observations = [], reports = [], actions = []
    const manager = new BotManager({ minecraft: {}, bot: { prefix: '!', owner: 'Owner' } }, {
        reconnect: { min: 60_000, max: 60_000 },
        inputOptions: { consoleOptions: { input: source, output }, write: text => replies.push(text) },
        createReporter: bus => new ConsoleObservationReporter(bus, { write: text => reports.push(text) }),
        onObservation: observation => observations.push(observation),
        createBot() {
            const bot = Object.assign(new EventEmitter(), {
                username: 'TestBot', version: '1.20.4', registry: minecraftData('1.20.4'),
                entity: { id: 1, position: { x: 0, y: 64, z: 0 }, yaw: 0, pitch: 0 },
                entities: {}, health: 20, food: 18, oxygenLevel: 20,
                players: { Alice: { entity: { position: { x: 4, y: 64, z: 6 } } } },
                inventory: { items: () => [{ name: 'stone', count: bots.length }] },
                loadPlugin() {}, blockAt: () => null,
                blockAtCursor: () => null, entityAtCursor: () => null,
                pathfinder: { setMovements() {},
                    async goto(goal) { actions.push(['goto', goal.x, goal.y, goal.z]) },
                    setGoal(goal, dynamic) { actions.push(['goal', goal, dynamic]) },
                    stop() { actions.push(['stop']) }
                },
                collectBlock: { targets: { clear() { actions.push(['targets']) } } },
                clearControlStates() { actions.push(['controls']) },
                chat(text) { replies.push(text) },
                quit() { this.quitCalled = true; this.emit('end', 'quit') }
            })
            configureBot(bot)
            bots.push(bot)
            return bot
        },
        ...options
    })
    t.after(async () => { await manager.stop(); source.destroy(); output.destroy() })
    return { manager, bots, source, replies, observations, reports, actions }
}

async function connect(manager) {
    manager.start()
    manager.bot.emit('spawn')
    await manager.sessionReady
}

test('BotManager owns six independent subsystems and gives each only its frozen contract', async t => {
    const { manager } = application(t)
    await connect(manager)
    const managers = [manager.inputs, manager.commands, manager.perception, manager.states, manager.plugins, manager.services]
    assert.ok(managers.every(Boolean))
    assert.equal(new Set(managers.map(subsystem => subsystem.contract)).size, 6)
    for (const subsystem of managers) {
        assert.equal(Object.isFrozen(subsystem.contract), true)
        for (const other of managers) assert.equal(Object.values(subsystem.contract).includes(other), false)
    }
    assert.deepEqual(Object.keys(manager.inputs.contract).sort(), ['handleInput', 'shutdown'])
    assert.deepEqual(Object.keys(manager.perception.contract), ['publishObservation'])
    for (const subsystem of [manager.services, manager.states, manager.plugins]) {
        assert.deepEqual(Object.keys(subsystem.contract), [])
    }
    assert.equal('bot' in manager.commands, false)
    assert.equal('perception' in manager.commands, false)
    assert.ok(manager.commands.loader instanceof CommandLoader)
    assert.ok(manager.commands.registry instanceof CommandRegistry)
    await manager.commands.initialize()
    assert.equal(manager.commands.registry.size, 14, 'loading is idempotent')
    manager.services.memory.setHome({ x: 1, y: 2, z: 3 })
    assert.deepEqual(manager.services.memory.getHome(), { x: 1, y: 2, z: 3 })
    const lifecycle = []
    await manager.states.start({ async start(options) { lifecycle.push(options) }, async stop() { lifecycle.push('stop') } }, { manual: true })
    manager.plugins.register('existing', { existing: true })
    assert.deepEqual(manager.plugins.get('existing'), { existing: true })
    const plugins = manager.plugins
    await manager.stop()
    assert.deepEqual(lifecycle, [{ manual: true }, 'stop'])
    assert.equal(plugins.get('existing'), undefined)
})

test('CommandContract forwards explicit capability methods with unchanged parameters and results', async t => {
    const { manager } = application(t)
    await connect(manager)
    const contract = manager.commands.contract
    const calls = [], result = { status: 'success' }
    const options = { onStart() {} }
    for (const [method, args] of [
        ['goto', [1, 64, -2]], ['follow', ['Alice']], ['stop', []], ['mine', ['oak_log', 10]],
        ['chopTree', [options]], ['craft', ['oak_planks', 8]], ['inventory', []], ['equip', ['iron_helmet', 'head']]
    ]) {
        t.mock.method(manager.services, method, (...actual) => { calls.push([method, actual]); return result })
        assert.equal(await contract[method](...args), result)
        assert.deepEqual(calls.at(-1), [method, args])
    }
    const position = contract.playerPosition('Alice')
    assert.deepEqual(position, { x: 4, y: 64, z: 6 })
    position.x = 500
    assert.equal(manager.bot.players.Alice.entity.position.x, 4, 'player lookup returns only a copy of coordinates')
    assert.equal(contract.playerPosition('Missing'), null)
    assert.deepEqual(Object.keys(contract).sort(), ['goto', 'follow', 'stop', 'mine', 'chopTree', 'craft',
        'inventory', 'equip', 'playerPosition', 'status', 'look', 'nearby', 'environment', 'scan', 'reply'].sort())
})

test('input, command contract and services preserve chat/console routing and perception reporting', async t => {
    const { manager, source, replies, actions, observations, reports } = application(t)
    t.mock.method(MiningService, 'mine', async (bot, block, count) => {
        assert.equal(bot, manager.bot)
        assert.equal(block, 'oak_log')
        return { status: 'success', requested: count, completed: count }
    })
    await connect(manager)
    source.write('  !goto 1 64 -2  \n')
    manager.bot.emit('chat', 'Alice', '!goto')
    manager.bot.emit('chat', 'TestBot', '!goto 99 99 99')
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(actions, [['goto', 1, 64, -2], ['goto', 4, 64, 6]])
    assert.equal(replies.filter(text => text === 'Arrived.').length, 2)
    await manager.commands.handle('Alice', '!mine oak_log 10')
    assert.equal(replies.at(-1), 'Mined 10/10 oak_log blocks.')
    for (const [name, type] of [['status', 'status.snapshot'], ['look', 'look.snapshot'],
        ['nearby', 'entities.snapshot'], ['environment', 'environment.snapshot'], ['scan', 'scan.snapshot']]) {
        await manager.commands.handle('Alice', `!${name}`)
        assert.equal(observations.at(-1).type, type)
        assert.deepEqual(Object.keys(observations.at(-1)).sort(), ['data', 'priority', 'type'])
    }
    assert.equal(reports.length, 5, 'the owned reporter publishes each request once')
    actions.length = 0
    await manager.commands.handle('Alice', '!stop')
    assert.deepEqual(actions.map(action => action[0]), ['targets', 'stop', 'goal', 'controls'])
    assert.equal(replies.at(-1), 'Stopped.')
})

test('session managers and contracts are replaced on reconnect and old capabilities cannot use the new bot', async t => {
    const { manager, source, bots, replies } = application(t)
    await connect(manager)
    const old = { commands: manager.commands, services: manager.services, perception: manager.perception,
        states: manager.states, plugins: manager.plugins }
    const inputs = manager.inputs, terminal = inputs.console, readline = terminal.readline
    assert.equal(old.commands.contract.inventory().items[0].count, 1)
    bots[0].emit('end', 'disconnected')
    await manager.disposal
    assert.equal(bots[0].listenerCount('chat'), 0)
    assert.equal(old.services.bot, null)
    assert.equal(old.perception.running, false)
    assert.throws(() => old.commands.contract.inventory(), /not ready/)
    assert.throws(() => old.commands.contract.status(), /not ready/)
    source.write('!inventory\n')
    assert.equal(replies.at(-1), '[CONSOLE] Bot is not ready.')
    await connect(manager)
    assert.equal(manager.inputs, inputs)
    assert.equal(manager.inputs.console, terminal)
    assert.equal(terminal.readline, readline)
    for (const key of Object.keys(old)) assert.notEqual(manager[key], old[key])
    assert.equal(manager.commands.contract.inventory().items[0].count, 2)
    source.write('!inventory\n')
    assert.equal(replies.at(-1), 'stone x2')
    const count = replies.length
    bots[0].emit('chat', 'Alice', '!inventory')
    old.commands.contract.reply('stale reply')
    assert.equal(replies.length, count)
})

for (const phase of ['plugin', 'commands', 'perception', 'ready']) {
    test(`initialization failure in ${phase} releases partial session resources and permits reconnect`, async t => {
        const errors = t.mock.method(console, 'error', () => {})
        let perception
        const options = {
            createPerception(bot, options) {
                perception = new PerceptionManager(bot, options)
                if (phase === 'perception') {
                    const original = perception.entityDetector.start.bind(perception.entityDetector)
                    perception.entityDetector.start = () => { original(); throw new Error('detector failed') }
                }
                return perception
            },
            ...(phase === 'commands' ? { commandOptions: { loader: { async load() { throw new Error('load failed') } } } } : {}),
            ...(phase === 'ready' ? { onReady() { throw new Error('ready failed') } } : {})
        }
        const { manager, bots, source, replies } = application(t, options, bot => {
            if (phase === 'plugin') bot.loadPlugin = () => { throw new Error('plugin failed') }
        })
        manager.start()
        if (phase !== 'plugin') bots[0].emit('spawn')
        await manager.sessionReady
        assert.equal(manager.bot, null)
        assert.equal(manager.ready, false)
        assert.equal(manager.commands, null)
        assert.equal(manager.services, null)
        assert.equal(bots[0].quitCalled, true)
        for (const event of ['spawn', 'end', 'chat', 'entityMoved', 'health', 'soundEffectHeard']) {
            assert.equal(bots[0].listenerCount(event), 0, event)
        }
        if (perception) {
            assert.equal(perception.running, false)
            assert.equal(perception.reporter.unsubscribe, null)
            assert.equal(perception.bus.events.listenerCount('observation'), 0)
        }
        assert.ok(manager.reconnectTimer)
        assert.equal(errors.mock.callCount(), 1)
        source.write('!status\n')
        assert.equal(replies.at(-1), '[CONSOLE] Bot is not ready.')
        await manager.stop()
        assert.equal(manager.reconnectTimer, null)
    })
}

test('a command load completing after shutdown cannot restart the old session', async t => {
    let finishLoad, readyCalls = 0
    const loading = new Promise(resolve => { finishLoad = resolve })
    const { manager, bots } = application(t, {
        commandOptions: { loader: { load: () => loading } }, onReady() { readyCalls++ }
    })
    manager.start(); bots[0].emit('spawn')
    const initialization = manager.sessionReady
    await manager.stop()
    finishLoad([])
    await initialization
    assert.equal(manager.bot, null)
    assert.equal(manager.ready, false)
    assert.equal(manager.perception, null)
    assert.equal(bots[0].listenerCount('chat'), 0)
    assert.equal(readyCalls, 0)
})

test('cleanup continues after synchronous and asynchronous failures without unhandled promises', async t => {
    const errors = t.mock.method(console, 'error', () => {})
    const { manager, bots } = application(t, { onReady: () => () => { throw new Error('cleanup failed') } })
    await connect(manager)
    const perception = manager.perception
    t.mock.method(manager.states, 'stop', async () => { throw new Error('state cleanup failed') })
    await manager.stop()
    assert.equal(errors.mock.callCount(), 2)
    assert.equal(perception.running, false)
    assert.equal(perception.bus.events.listenerCount('observation'), 0)
    assert.equal(bots[0].listenerCount('chat'), 0)
    assert.equal(manager.inputs.console.readline, null)
})

test('rejected observation consumers are diagnosed locally without changing the observation bus', async t => {
    const errors = t.mock.method(console, 'error', () => {})
    const { manager } = application(t, { onObservation: async () => { throw new Error('observer failed') } })
    await connect(manager)
    manager.commands.contract.status()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(errors.mock.callCount(), 1)
    assert.match(errors.mock.calls[0].arguments[0], /PERCEPTION/)
})

test('InputManager knows only its input contract and uses the configured console identity', async t => {
    const source = new PassThrough(), output = new PassThrough(), messages = []
    let shutdowns = 0
    const input = new InputManager(Object.freeze({
        handleInput(message) { messages.push(message) }, shutdown() { shutdowns++ }
    }), { username: 'Owner', consoleOptions: { input: source, output }, write() {} })
    t.after(() => { input.stop(); source.destroy(); output.destroy() })
    input.start(); input.start()
    const bot = Object.assign(new EventEmitter(), { username: 'TestBot' })
    input.startSession(bot)
    source.write('  !help  \n\n')
    bot.emit('chat', 'Alice', ' !help')
    assert.equal(messages.length, 2)
    assert.deepEqual(messages.map(({ source, username, message }) => ({ source, username, message })), [
        { source: 'console', username: 'Owner', message: '!help' },
        { source: 'chat', username: 'Alice', message: ' !help' }
    ])
    input.console.readline.emit('SIGINT')
    assert.equal(shutdowns, 1)
    input.stopSession()
    assert.equal(bot.listenerCount('chat'), 0)
    assert.ok(input.console.readline)
})

test('subsystem managers and command handlers do not import other subsystems or expose Mineflayer to commands', async t => {
    t.mock.method(console, 'log', () => {})
    for (const file of ['inputs/InputManager.js', 'commands/CommandManager.js', 'perception/PerceptionManager.js',
        'states/StateManager.js', 'plugins/PluginManager.js', 'services/ServiceManager.js']) {
        const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')
        assert.doesNotMatch(source, /from ['"]\.\.\/(?:inputs|commands|perception|states|plugins|services|core)\//, file)
    }
    const commands = await new CommandLoader(new URL('../src/commands/handlers/', import.meta.url)).load()
    for (const command of commands) {
        assert.doesNotMatch(command.execute.toString(), /\bbot\b|\bperception\b|Service\./, command.name)
    }
})
