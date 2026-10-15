import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import minecraftData from 'minecraft-data'
import BotManager from '../src/core/BotManager.js'
import CommandManager from '../src/core/CommandManager.js'
import CommandRegistry from '../src/core/CommandRegistry.js'
import ConsoleObservationReporter from '../src/perception/ConsoleObservationReporter.js'

test('BotManager owns perception per connection, reuses it on respawn and cleans old listeners', async t => {
    t.mock.method(console, 'log', () => {})
    const bots = [], ready = [], output = [], foreignHealth = () => {}
    const createBot = () => {
        const bot = Object.assign(new EventEmitter(), {
            version: '1.20.4', registry: minecraftData('1.20.4'), username: 'TestBot',
            entity: { id: bots.length + 1, position: { x: 0, y: 64, z: 0 }, yaw: 0, pitch: 0 },
            entities: {}, health: 20, food: 20, oxygenLevel: 20, isRaining: false,
            pathfinder: { setMovements() {} }, loadPlugin() {}, quit() { this.quitCalled = true }
        })
        bot.on('health', foreignHealth)
        bots.push(bot)
        return bot
    }
    const manager = new BotManager({ minecraft: {} }, { createBot, reconnect: { min: 5, max: 10 },
        createReporter: bus => new ConsoleObservationReporter(bus, { write: text => output.push(text) }),
        onReady(bot, perception) {
            ready.push(perception)
            manager.commandManager = new CommandManager(bot, { bot: { prefix: '!' } }, new CommandRegistry(), { perception })
            manager.commandManager.load()
        }
    })
    t.after(() => manager.stop())
    manager.start(); manager.start()
    assert.equal(bots.length, 1, 'start is idempotent while connected')
    bots[0].emit('spawn')
    assert.equal(ready.length, 1)
    const first = manager.perception
    assert.equal(bots[0].listenerCount('health'), 2)
    bots[0].emit('respawn'); bots[0].emit('spawn')
    assert.equal(manager.perception, first)
    assert.equal(ready.length, 1, 'same-bot respawn must not register another session')
    bots[0].health = 16; bots[0].emit('health')
    assert.match(output.at(-1), /20 → 16/)
    bots[0].emit('end', 'closed')
    assert.equal(first.running, false)
    assert.equal(manager.commandManager, null)
    assert.equal(bots[0].listenerCount('health'), 1, 'preserve listeners owned by other layers')
    for (const event of ['entityMoved', 'soundEffectHeard', 'breath', 'chat', 'end', 'kicked', 'respawn', 'spawn']) {
        assert.equal(bots[0].listenerCount(event), 0, event)
    }
    const before = output.length
    bots[0].health = 1; bots[0].emit('health')
    assert.equal(output.length, before, 'the dead connection cannot publish observations')
    const deadline = Date.now() + 2_000
    while (bots.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(bots.length, 2)
    bots[1].emit('spawn')
    assert.equal(ready.length, 2)
    assert.notEqual(manager.perception, first)
    manager.stop()
    assert.equal(bots[1].quitCalled, true)
    assert.equal(manager.perception, null)
    assert.equal(bots[1].listenerCount('health'), 1)
    assert.equal(bots[1].listenerCount('chat'), 0)
    assert.equal(manager.reconnectTimer, null)
})

test('disconnect before first spawn cannot later activate a stale perception session', t => {
    t.mock.method(console, 'log', () => {})
    const bot = Object.assign(new EventEmitter(), { loadPlugin() {}, quit() {} })
    const manager = new BotManager({ minecraft: {} }, { createBot: () => bot, reconnect: { min: 60_000 } })
    manager.start()
    bot.emit('end', 'failed login')
    bot.emit('spawn')
    assert.equal(manager.perception, null)
    manager.stop()
    assert.equal(bot.listenerCount('spawn'), 0)
})
