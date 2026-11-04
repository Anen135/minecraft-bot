import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import minecraftData from 'minecraft-data'
import ChatInput from '../src/inputs/ChatInput.js'
import ConsoleInput from '../src/inputs/ConsoleInput.js'
import BotManager from '../src/core/BotManager.js'

test('ChatInput forwards raw messages, ignores itself, starts once and removes only its listener', () => {
    const bot = Object.assign(new EventEmitter(), { username: 'TestBot' })
    const foreign = () => {}
    bot.on('chat', foreign)
    const input = new ChatInput(bot), calls = []
    input.start((...args) => calls.push(args))
    input.start(() => assert.fail('must not register again'))
    assert.equal(bot.listenerCount('chat'), 2)
    bot.emit('chat', 'TestBot', 'ignored')
    bot.emit('chat', 'Alice', '  raw message !hello  ')
    assert.deepEqual(calls, [['Alice', '  raw message !hello  ']])
    input.stop(); input.stop()
    assert.deepEqual(bot.listeners('chat'), [foreign])
    bot.emit('chat', 'Alice', 'inactive')
    assert.equal(calls.length, 1)
    input.start((...args) => calls.push(args))
    bot.emit('chat', 'Bob', 'restarted')
    assert.deepEqual(calls.at(-1), ['Bob', 'restarted'])
    input.stop()
})

test('ConsoleInput forwards every raw line, starts once, and releases readline listeners', async t => {
    const source = new PassThrough(), destination = new PassThrough(), calls = []
    const input = new ConsoleInput({ input: source, output: destination })
    t.after(() => { input.stop(); source.destroy(); destination.destroy() })
    input.start(line => calls.push(line))
    const readline = input.readline
    input.start(() => assert.fail('must not register again'))
    assert.equal(input.readline, readline)
    assert.equal(readline.listenerCount('line'), 1)
    source.write('  raw text  \n\n!help\n')
    assert.deepEqual(calls, ['  raw text  ', '', '!help'])
    input.stop(); input.stop()
    for (const event of ['line', 'SIGINT', 'close']) assert.equal(readline.listenerCount(event), 0)
    assert.equal(source.listenerCount('data'), 0)
    assert.equal(source.listenerCount('end'), 0)
    source.write('inactive\n')
    assert.equal(calls.length, 3)
    input.start(line => calls.push(line))
    source.write('restarted\n')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls.at(-1), 'restarted')
    const ended = once(source, 'end')
    source.end()
    await ended
    assert.equal(input.readline, null, 'EOF releases input resources')
})

test('inputs report synchronous throws and rejected callbacks locally and remain usable', async t => {
    const errors = t.mock.method(console, 'error', () => {})
    const bot = Object.assign(new EventEmitter(), { username: 'TestBot' })
    const source = new PassThrough(), destination = new PassThrough()
    const chat = new ChatInput(bot)
    const terminal = new ConsoleInput({ input: source, output: destination })
    t.after(() => { chat.stop(); terminal.stop(); source.destroy(); destination.destroy() })
    for (const input of [chat, terminal]) {
        let calls = 0
        input.start(() => {
            calls++
            if (calls === 1) throw new Error('sync failure')
            if (calls === 2) return Promise.reject(new Error('async failure'))
        })
        for (let index = 0; index < 3; index++) {
            if (input === chat) bot.emit('chat', 'Alice', 'message')
            else source.write('line\n')
        }
        await new Promise(resolve => setImmediate(resolve))
        assert.equal(calls, 3)
    }
    assert.equal(errors.mock.callCount(), 4)
    for (const source of ['ChatInput', 'ConsoleInput']) {
        const messages = errors.mock.calls.filter(call => call.arguments[0].includes(source))
        assert.equal(messages.length, 2)
        assert.deepEqual(messages.map(call => call.arguments[1].message), ['sync failure', 'async failure'])
    }
    // node:test also fails if a callback leaks an unhandled rejection.
})

test('chat belongs to each connection while the same console routes to the latest manager', async t => {
    t.mock.method(console, 'log', () => {})
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const bots = [], cleaned = [], executions = [], replies = []
    const command = { name: 'ping', execute(context) {
        executions.push(context)
        context.reply(context.username === 'Owner' ? 'console reply' : 'chat reply')
    } }
    const source = new PassThrough(), destination = new PassThrough()
    const config = { minecraft: {}, bot: { prefix: '!' } }
    const manager = new BotManager(config, {
        reconnect: { min: 5, max: 10 },
        commandOptions: { loader: { async load() { return [command] } } },
        inputOptions: { username: 'Owner', consoleOptions: { input: source, output: destination },
            write: message => replies.push(message) },
        createBot() {
            const bot = Object.assign(new EventEmitter(), {
                username: 'TestBot', version: '1.20.4', registry: minecraftData('1.20.4'),
                loadPlugin() {}, pathfinder: { setMovements() {} },
                chat(message) { replies.push(message) }, quit() { this.emit('end', 'quit') }
            })
            bots.push(bot)
            return bot
        },
        createPerception: () => ({ bus: {}, start() {}, stop() {} }),
        createReporter: () => ({ start() {}, stop() {} }),
        onReady(bot) { return () => { cleaned.push(bot) } }
    })
    t.after(async () => { await manager.stop(); source.destroy(); destination.destroy() })
    manager.start()
    const terminal = manager.inputs.console
    const readline = terminal.readline
    source.write('!ping\n')
    bots[0].emit('spawn')
    await manager.sessionReady
    const firstCommands = manager.commands
    source.write('!ping first\n')
    bots[0].emit('chat', 'Alice', '!ping first')
    assert.equal(executions.length, 2)
    assert.ok(executions.every(context => context.contract === firstCommands.contract && !('bot' in context) && !('perception' in context)))

    bots[0].emit('end', 'disconnect')
    assert.equal(bots[0].listenerCount('chat'), 0)
    assert.equal(manager.commands, null)
    assert.equal(terminal.readline, readline)
    bots[0].emit('chat', 'Alice', '!ping stale')
    source.write('!ping between\n')
    assert.equal(executions.length, 2)
    await manager.disposal
    t.mock.timers.tick(5)
    bots[1].emit('spawn')
    await manager.sessionReady
    assert.equal(bots[1].listenerCount('chat'), 1)
    source.write('!ping second\n')
    bots[1].emit('chat', 'Bob', '!ping second')
    assert.equal(executions.length, 4)
    assert.ok(executions.slice(2).every(context => context.contract === manager.commands.contract))
    assert.deepEqual(executions.map(context => context.username), ['Owner', 'Alice', 'Owner', 'Bob'])
    assert.deepEqual(replies, ['[CONSOLE] Bot is not ready.', 'console reply', 'chat reply', '[CONSOLE] Bot is not ready.', 'console reply', 'chat reply'])
    manager.stop(); manager.stop()
    assert.deepEqual(cleaned, bots)
    assert.equal(bots[1].listenerCount('chat'), 0)
    t.mock.timers.tick(100)
    assert.equal(bots.length, 2)
    await new Promise(resolve => setImmediate(resolve))
})

test('a failing session cleanup is reported once and does not prevent shutdown', async t => {
    t.mock.method(console, 'log', () => {})
    const errors = t.mock.method(console, 'error', () => {})
    let cleanups = 0, quits = 0, perceptionStops = 0, reporterStops = 0
    const bot = Object.assign(new EventEmitter(), {
        username: 'TestBot', version: '1.20.4', registry: minecraftData('1.20.4'),
        loadPlugin() {}, pathfinder: { setMovements() {} }, quit() { quits++ }
    })
    const manager = new BotManager({ minecraft: {} }, {
        createBot: () => bot,
        createPerception: () => ({ bus: {}, start() {}, stop() { perceptionStops++; reporterStops++ } }),
        onReady: () => () => { cleanups++; throw new Error('cleanup failed') }
    })
    manager.start(); bot.emit('spawn')
    await manager.sessionReady
    manager.stop(); manager.stop(); bot.emit('end', 'late end')
    assert.deepEqual([cleanups, quits, perceptionStops, reporterStops], [1, 1, 1, 1])
    assert.equal(errors.mock.callCount(), 1)
    assert.equal(bot.listenerCount('end'), 0)
})

test('terminal Ctrl+C shuts down and lets the process exit', { timeout: 5000 }, async t => {
    const managerUrl = new URL('../src/core/BotManager.js', import.meta.url).href
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
        import BotManager from ${JSON.stringify(managerUrl)}
        import { EventEmitter } from 'node:events'
        process.stdin.isTTY = true
        process.stdin.setRawMode = () => {}
        process.stdout.isTTY = true
        const bot = Object.assign(new EventEmitter(), { loadPlugin() {}, quit() {} })
        const manager = new BotManager({ minecraft: {}, bot: { prefix: '!' } }, {
            createBot: () => bot, reconnect: { min: 60000, max: 60000 }
        })
        const stop = manager.stop.bind(manager)
        manager.stop = async () => { await stop(); console.log('STOPPED') }
        process.once('SIGINT', () => { void manager.stop() })
        manager.start()
        bot.emit('end', 'simulate reconnect')
        await manager.disposal
        console.log('READY')
    `], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    t.after(() => child.kill())
    let output = '', errors = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { errors += chunk })
    const closed = once(child, 'close')
    while (!output.includes('READY')) await once(child.stdout, 'data')
    child.stdin.write('\u0003')
    const [code, signal] = await closed
    assert.equal(code, 0, errors)
    assert.equal(signal, null)
    assert.match(output, /STOPPED/)
})
