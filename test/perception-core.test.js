import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import ObservationBus from '../src/perception/ObservationBus.js'
import PerceptionManager from '../src/perception/PerceptionManager.js'
import ConsoleObservationReporter, { formatObservation } from '../src/perception/ConsoleObservationReporter.js'
import CommandManager from '../src/core/CommandManager.js'
import CommandRegistry from '../src/core/CommandRegistry.js'
import ConsoleInput from '../src/core/ConsoleInput.js'
import status from '../src/commands/status.js'
import look from '../src/commands/look.js'
import nearby from '../src/commands/nearby.js'
import scan from '../src/commands/scan.js'
import environment from '../src/commands/environment.js'
import inventory from '../src/commands/inventory.js'

function botFixture() {
    return Object.assign(new EventEmitter(), {
        username: 'TestBot', entity: { id: 1, position: { x: 10, y: 64, z: 20 }, yaw: 0, pitch: 0 },
        entities: {}, health: 20, food: 18, oxygenLevel: 20, heldItem: { name: 'stone_pickaxe' },
        game: { gameMode: 'survival', dimension: 'overworld' }, time: { timeOfDay: 18_000, isDay: false },
        isRaining: false, inventory: { items: () => [{ name: 'stone', count: 4 }] },
        blockAtCursor: () => null, entityAtCursor: () => null,
        chat() { assert.fail('Perception/console must not send chat or actions.') }
    })
}

test('ObservationBus subscriptions emit structured data and unsubscribe independently', () => {
    const bus = new ObservationBus()
    const first = [], second = []
    const off = bus.on(observation => first.push(observation))
    bus.on(observation => second.push(observation))
    const observation = { type: 'health.changed', priority: 'warning', data: { previous: 20, current: 16, difference: -4 } }
    assert.equal(bus.emit(observation), observation)
    assert.deepEqual(first, [observation])
    off(); off()
    bus.emit(observation)
    assert.equal(first.length, 1)
    assert.equal(second.length, 2)
    assert.throws(() => bus.emit({ type: 'x', priority: 'invalid', data: {} }), TypeError)
    assert.throws(() => bus.emit({ type: 'x', priority: 'info', data: 'just a message' }), TypeError)
})

test('reporter formats active snapshots and passive structured events with priority filtering', () => {
    assert.equal(formatObservation({ type: 'health.changed', priority: 'warning', data: { previous: 20, current: 16 } }), '[!] [HP] 20 → 16')
    assert.match(formatObservation({ type: 'entity.near', priority: 'warning', data: {
        entityType: 'zombie', distance: 4.2, direction: 'NW', relativeDirection: 'LEFT'
    } }), /Nearby: zombie — 4.2m NW \(LEFT\)/)
    assert.match(formatObservation({ type: 'look.snapshot', priority: 'info', data: { kind: 'none', available: true } }), /nothing interesting/)
    assert.match(formatObservation({ type: 'look.snapshot', priority: 'info', data: {
        kind: 'block', name: 'coal_ore', distance: 4.3, position: { x: 1, y: 2, z: 3 }
    } }), /coal_ore — 4.3m · 1 2 3/)
    assert.equal(formatObservation({ type: 'unknown', priority: 'info', data: {} }), null)
    const pickup = formatObservation({ type: 'item.collected', priority: 'info',
        data: { itemName: 'cobblestone', count: null, observedStackCount: 64 } })
    assert.match(pickup, /cobblestone/)
    assert.doesNotMatch(pickup, /x64/, 'ground stack size is not a confirmed pickup count')
    const bus = new ObservationBus(), output = []
    const reporter = new ConsoleObservationReporter(bus, { write: text => output.push(text), minPriority: 'warning' })
    reporter.start(); reporter.start()
    bus.emit({ type: 'food.changed', priority: 'info', data: { previous: 20, current: 20 } })
    bus.emit({ type: 'health.changed', priority: 'danger', data: { previous: 6, current: 0 } })
    bus.emit({ type: 'look.snapshot', priority: 'info', data: { kind: 'none', available: true } })
    assert.equal(output.length, 2, 'active requests remain visible regardless of passive minimum')
    assert.match(output[0], /6 → 0/)
    reporter.stop(); reporter.stop()
    bus.emit({ type: 'player.death', priority: 'danger', data: {} })
    assert.equal(output.length, 2)
})

test('PerceptionManager scan emits one compact structured summary without action calls', () => {
    const bot = botFixture(), perception = new PerceptionManager(bot), observed = []
    perception.bus.on(observation => observed.push(observation))
    assert.throws(() => perception.scan(), /not ready/)
    perception.start(); perception.start()
    const summary = perception.scan()
    assert.equal(observed.length, 1)
    assert.equal(summary.type, 'scan.snapshot')
    assert.equal(summary.data.status.health, 20)
    assert.equal(summary.data.status.facing.direction, 'N')
    assert.deepEqual(summary.data.nearby.entities, [])
    assert.equal(summary.data.environment.isDay, false)
    const text = formatObservation(summary)
    assert.match(text, /HP: 20\/20/)
    assert.match(text, /Facing: N/)
    assert.match(text, /night/)
    assert.doesNotThrow(() => JSON.stringify(summary))
    perception.stop(); perception.stop()
    assert.equal(bot.listenerCount('health'), 0)
    assert.equal(bot.listenerCount('entityMoved'), 0)
    assert.throws(() => perception.status(), /not ready/)
})

test('commands route through perception and console replies without copying detection logic', async () => {
    const bot = botFixture(), perception = new PerceptionManager(bot), output = []
    const reporter = new ConsoleObservationReporter(perception.bus, { write: text => output.push(text) })
    perception.start(); reporter.start()
    const registry = new CommandRegistry([status, look, nearby, scan, environment, inventory])
    const manager = new CommandManager(bot, { bot: { prefix: '!' } }, registry, { perception })
    manager.load(); manager.load()
    assert.equal(bot.listenerCount('chat'), 1)
    const input = new ConsoleInput(() => manager, { username: 'Owner', output: { write: text => output.push(text) } })
    for (const name of ['status', 'look', 'nearby', 'scan', 'environment', 'inventory']) await input.handle(`!${name}`)
    assert.equal(output.length, 6)
    assert.match(output.at(-1), /stone x4/)
    manager.unload(); manager.unload()
    assert.equal(bot.listenerCount('chat'), 0)
    reporter.stop(); perception.stop()
})

test('console input obtains the latest connected manager and clears readline listeners', async () => {
    const inputStream = new PassThrough(), output = [], calls = []
    let current = null
    const input = new ConsoleInput(() => current, { input: inputStream,
        output: { write: text => output.push(text) }, username: 'Owner' })
    await input.handle('!status')
    assert.match(output[0], /not ready/)
    current = { bot: { username: 'newBot' }, async handle(username, message, { reply }) {
        calls.push([username, message]); reply('ready')
    } }
    input.start(); input.start()
    inputStream.write('!look\n')
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(calls, [['Owner', '!look']])
    assert.match(output.at(-1), /ready/)
    input.stop(); input.stop()
    inputStream.write('!scan\n')
    assert.equal(calls.length, 1)
    inputStream.destroy()
})

test('terminal Ctrl+C invokes shared shutdown rather than just closing readline', async () => {
    const source = new PassThrough(), destination = new PassThrough()
    source.isTTY = true
    source.setRawMode = () => {}
    destination.isTTY = true
    destination.columns = 80
    let interrupts = 0
    const input = new ConsoleInput(() => null, { input: source, output: destination,
        onInterrupt() { interrupts++; input.stop() } })
    input.start()
    source.write('\u0003')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(interrupts, 1)
    assert.equal(input.readline, null)
    source.destroy(); destination.destroy()
})
