import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import EventDetector from '../src/perception/detectors/EventDetector.js'

function setup(overrides = {}) {
    const bot = Object.assign(new EventEmitter(), {
        entity: { id: 1, position: { x: 0, y: 64, z: 0 }, yaw: 0 },
        health: 20, food: 20, oxygenLevel: 20, isRaining: false
    }, overrides)
    const observations = []
    let clock = 0
    const detector = new EventDetector(bot, { emit: observation => observations.push(observation) }, { now: () => clock })
    detector.start()
    return { bot, detector, observations, tick: ms => { clock += ms } }
}

test('health and food report changed real values including zero without repeated-event spam', () => {
    const { bot, detector, observations } = setup()
    bot.health = 16
    bot.food = 18
    bot.emit('health')
    assert.deepEqual(observations.map(observation => observation.type), ['health.changed', 'food.changed'])
    assert.deepEqual(observations[0].data, { previous: 20, current: 16, difference: -4 })
    for (let i = 0; i < 100; i++) bot.emit('health')
    assert.equal(observations.length, 2)
    bot.health = 0
    bot.emit('health')
    assert.equal(observations.at(-1).priority, 'danger')
    assert.equal(observations.at(-1).data.current, 0)
    bot.emit('death')
    assert.equal(observations.at(-1).type, 'player.death')
    detector.stop()
})

test('missing vitals establish a baseline rather than fabricating zero or a difference', () => {
    const { bot, detector, observations } = setup({ health: undefined, food: null, oxygenLevel: undefined })
    bot.emit('health')
    bot.emit('breath')
    bot.health = 10
    bot.food = 0
    bot.oxygenLevel = 5
    bot.emit('health')
    bot.emit('breath')
    assert.equal(observations.length, 0)
    bot.health = NaN
    bot.emit('health')
    bot.health = 9
    bot.emit('health')
    assert.deepEqual(observations[0].data, { previous: 10, current: 9, difference: -1 })
    detector.stop()
})

test('oxygen reports meaningful zone transitions and low oxygen without asserting a drowning cause', () => {
    const { bot, detector, observations } = setup()
    for (const oxygen of [19, 18, 17, 16, 15, 14, 13, 12, 11]) {
        bot.oxygenLevel = oxygen
        bot.emit('breath')
    }
    assert.equal(observations.length, 1)
    for (const oxygen of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]) {
        bot.oxygenLevel = oxygen
        bot.emit('breath')
    }
    assert.deepEqual(observations.map(observation => observation.type), [
        'oxygen.changed', 'oxygen.changed', 'oxygen.changed', 'oxygen.critical', 'oxygen.changed', 'oxygen.critical'
    ])
    assert.equal(observations.at(-1).data.current, 0)
    bot.emit('breath')
    assert.equal(observations.length, 6)
    detector.stop()
})

test('item pickup uses public dropped-item API only and ignores other players and unsupported entities', () => {
    const { bot, detector, observations } = setup()
    const item = { id: 9, getDroppedItem: () => ({ name: 'cobblestone', count: 4 }) }
    bot.emit('playerCollect', { id: 2 }, item)
    bot.emit('playerCollect', bot.entity, { id: 3 })
    bot.emit('playerCollect', bot.entity, { getDroppedItem() { throw new Error('Unavailable') } })
    bot.emit('playerCollect', bot.entity, { getDroppedItem: () => ({ name: 'stone', count: 0 }) })
    assert.equal(observations.length, 0)
    bot.emit('playerCollect', bot.entity, item)
    assert.deepEqual(observations[0], { type: 'item.collected', priority: 'info',
        data: { entityId: 9, itemName: 'cobblestone', count: null, observedStackCount: 4 } })
    detector.stop()
})

test('rain boolean transitions are observed once even when weather fade packets are frequent', () => {
    const { bot, detector, observations } = setup()
    for (let i = 0; i < 20; i++) bot.emit('weatherUpdate')
    bot.isRaining = true
    bot.emit('rain')
    for (let i = 0; i < 20; i++) bot.emit('weatherUpdate')
    assert.equal(observations.length, 1)
    assert.deepEqual(observations[0].data, { previous: false, current: true, isRaining: true })
    bot.isRaining = false
    bot.emit('rain')
    assert.equal(observations.length, 2)
    detector.stop()
})

test('sound allowlist, radius, cooldown and public names filter noise without hardcoded ID decoding', () => {
    const { bot, detector, observations, tick } = setup()
    const near = { x: 3, y: 64, z: 0 }
    bot.emit('soundEffectHeard', 'entity.player.step', near, 1, 1)
    bot.emit('soundEffectHeard', 'entity.creeper.primed', { x: 30, y: 64, z: 0 }, 1, 1)
    bot.emit('hardcodedSoundEffectHeard', 19, 'master', near, 1, 1)
    assert.equal(observations.length, 0)
    bot.emit('soundEffectHeard', 'minecraft:entity.creeper.primed', near, 1, 0.8)
    assert.equal(observations[0].type, 'sound.heard')
    assert.equal(observations[0].priority, 'danger')
    assert.equal(observations[0].data.distance, 3)
    assert.equal(observations[0].data.direction, 'E')
    for (let i = 0; i < 30; i++) bot.emit('soundEffectHeard', 'entity.creeper.primed', near, 1, 1)
    assert.equal(observations.length, 1)
    bot.emit('soundEffectHeard', 'entity.zombie.ambient', near, 1, 1)
    assert.equal(observations.length, 2)
    tick(3_001)
    bot.emit('soundEffectHeard', 'entity.creeper.primed', near, 1, 1)
    assert.equal(observations.length, 3)
    detector.stop()
})

test('event lifecycle removes only owned listeners and silently resets stale vitals after respawn', () => {
    const { bot, detector, observations } = setup()
    const unrelated = () => {}
    bot.on('health', unrelated)
    detector.start()
    assert.equal(bot.listenerCount('health'), 2)
    bot.health = 20
    bot.food = 10
    bot.emit('respawn')
    assert.equal(observations.length, 1)
    assert.equal(observations[0].type, 'player.respawn')
    bot.emit('spawn')
    bot.emit('health')
    assert.equal(observations.length, 1)
    detector.stop()
    detector.stop()
    assert.deepEqual(bot.listeners('health'), [unrelated])
    assert.equal(bot.listenerCount('breath'), 0)
    assert.equal(bot.listenerCount('soundEffectHeard'), 0)
    bot.health = 0
    bot.emit('health')
    assert.equal(observations.length, 1)
    detector.start()
    bot.emit('health')
    assert.equal(observations.length, 1)
    detector.stop()
})
