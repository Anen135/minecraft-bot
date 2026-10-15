import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import EntityDetector from '../src/perception/detectors/EntityDetector.js'

function setup(entities = {}) {
    const bot = Object.assign(new EventEmitter(), {
        entity: { id: 1, position: { x: 0, y: 64, z: 0 }, yaw: 0 }, entities
    })
    const observations = []
    let clock = 0
    const detector = new EntityDetector(bot, { emit: observation => observations.push(observation) }, { now: () => clock })
    detector.start()
    return { bot, detector, observations, tick: ms => { clock += ms } }
}

function entity(id, x, name = 'zombie') {
    return { id, name, position: { x, y: 64, z: 0 } }
}

test('entity appearance and removal publish plain observations, excluding the bot and invalid positions', () => {
    const { bot, detector, observations } = setup()
    const zombie = entity(2, 12)
    bot.entities[2] = zombie
    bot.emit('entitySpawn', zombie)
    bot.emit('entitySpawn', bot.entity)
    bot.emit('entitySpawn', entity(3, 21))
    bot.emit('entitySpawn', entity(4, NaN))
    assert.equal(observations.length, 1)
    assert.equal(observations[0].type, 'entity.appeared')
    assert.equal(observations[0].data.entityType, 'zombie')
    assert.equal(observations[0].data.distance, 12)
    assert.equal(observations[0].data.direction, 'E')
    assert.equal(observations[0].priority, 'info')
    assert.deepEqual(JSON.parse(JSON.stringify(observations[0])), observations[0])
    bot.emit('entityGone', zombie)
    bot.emit('entityGone', zombie)
    assert.equal(observations.length, 2)
    assert.equal(observations[1].type, 'entity.disappeared')
    detector.stop()
})

test('entity significant zones and hysteresis suppress small movements and repeated updates', () => {
    const zombie = entity(2, 15)
    const { bot, observations, detector, tick } = setup({ 2: zombie })
    assert.equal(observations.length, 0, 'existing entities seed quietly')
    for (const x of [14.9, 14.8, 13, 10.1, 9.9, 9.6]) {
        zombie.position.x = x
        bot.emit('entityMoved', zombie)
    }
    assert.equal(observations.length, 0)
    zombie.position.x = 9.4
    bot.emit('entityMoved', zombie)
    assert.equal(observations.at(-1).type, 'entity.approaching')
    assert.equal(observations.at(-1).priority, 'warning')
    for (const x of [9.7, 10.1, 9.5, 9.1]) {
        zombie.position.x = x
        bot.emit('entityUpdate', zombie)
    }
    assert.equal(observations.length, 1)
    zombie.position.x = 4.4
    bot.emit('entityMoved', zombie)
    assert.equal(observations.at(-1).type, 'entity.near')
    zombie.position.x = 2.4
    bot.emit('entityMoved', zombie)
    assert.equal(observations.at(-1).type, 'entity.very_close')
    assert.equal(observations.at(-1).priority, 'danger')
    tick(2_000)
    zombie.position.x = 21
    bot.emit('entityMoved', zombie)
    assert.equal(observations.at(-1).type, 'entity.disappeared')
    detector.stop()
})

test('movement cooldown delays repeated approaching alerts without permanently losing a transition', () => {
    const zombie = entity(2, 15)
    const { bot, observations, detector, tick } = setup({ 2: zombie })
    zombie.position.x = 9
    bot.emit('entityMoved', zombie)
    zombie.position.x = 11
    bot.emit('entityMoved', zombie)
    zombie.position.x = 9
    bot.emit('entityMoved', zombie)
    assert.equal(observations.length, 1)
    tick(2_001)
    bot.emit('entityMoved', zombie)
    assert.equal(observations.length, 2)
    detector.stop()
})

test('close-zone oscillations respect cooldown but a new danger escalation is immediately visible', () => {
    const zombie = entity(2, 9)
    const { bot, observations, detector, tick } = setup({ 2: zombie })
    for (const x of [4, 6, 4, 6, 4]) {
        zombie.position.x = x
        bot.emit('entityMoved', zombie)
    }
    assert.equal(observations.length, 1)
    assert.equal(observations[0].type, 'entity.near')
    zombie.position.x = 2
    bot.emit('entityMoved', zombie)
    assert.equal(observations.length, 2)
    assert.equal(observations[1].type, 'entity.very_close')
    tick(2_001)
    zombie.position.x = 6
    bot.emit('entityMoved', zombie)
    zombie.position.x = 4
    bot.emit('entityMoved', zombie)
    assert.equal(observations.length, 3)
    detector.stop()
})

test('bot movement rescans relative distances, friends remain info, active scan does not alter passive state', () => {
    const cow = entity(2, 15, 'cow')
    const player = { ...entity(3, 12, 'player'), username: 'Roman' }
    const { bot, detector, observations } = setup({ 1: entity(1, 0), 2: cow, 3: player, 4: entity(4, 35) })
    const snapshot = detector.getSnapshot({ limit: 1 })
    assert.equal(snapshot.truncated, true)
    assert.equal(snapshot.entities[0].username, 'Roman')
    assert.equal(snapshot.entities[0].distance, 12)
    assert.equal(observations.length, 0)
    assert.equal(detector.scan().type, 'entities.snapshot')
    bot.entity.position.x = 12
    bot.emit('move')
    const alerts = observations.slice(1)
    assert.equal(alerts.length, 2)
    assert.ok(alerts.every(observation => observation.priority === 'info'))
    detector.stop()
})

test('entity start/stop is idempotent, removes exactly owned listeners and resets session baselines', () => {
    const zombie = entity(2, 15)
    const { bot, detector, observations } = setup({ 2: zombie })
    const unrelated = () => {}
    bot.on('entityMoved', unrelated)
    detector.start()
    assert.equal(bot.listenerCount('entityMoved'), 2)
    bot.emit('respawn')
    bot.entities = {}
    bot.emit('spawn')
    bot.emit('entityGone', zombie)
    assert.equal(observations.length, 0)
    detector.stop()
    detector.stop()
    assert.deepEqual(bot.listeners('entityMoved'), [unrelated])
    assert.equal(bot.listenerCount('move'), 0)
    bot.emit('entitySpawn', zombie)
    assert.equal(observations.length, 0)
    detector.start()
    bot.emit('entitySpawn', zombie)
    assert.equal(observations.length, 1)
    detector.stop()
})
