import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Vec3 } from 'vec3'
import rayTrace from 'mineflayer/lib/plugins/ray_trace.js'
import StatusDetector from '../src/perception/detectors/StatusDetector.js'
import LookDetector from '../src/perception/detectors/LookDetector.js'
import EnvironmentDetector from '../src/perception/detectors/EnvironmentDetector.js'
import { positionData, distanceBetween, directionFromYaw, directionBetween, relativeDirection } from '../src/perception/spatial.js'

test('spatial helpers preserve zero coordinates and reject unavailable positions', () => {
    const position = { x: 0, y: 64, z: -2, internal: 'not exposed' }
    assert.deepEqual(positionData(position), { x: 0, y: 64, z: -2 })
    assert.equal(positionData({ x: NaN, y: 0, z: 0 }), null)
    assert.equal(positionData(undefined), null)
    assert.equal(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5)
    assert.equal(distanceBetween(null, position), null)
})

test('directions match Mineflayer yaw and absolute Minecraft compass coordinates', () => {
    const origin = { x: 0, y: 0, z: 0 }
    assert.equal(directionFromYaw(0), 'N')
    assert.equal(directionFromYaw(Math.PI / 2), 'W')
    assert.equal(directionFromYaw(-Math.PI / 2), 'E')
    assert.equal(directionFromYaw(Math.PI), 'S')
    assert.equal(directionFromYaw(Math.PI * 2), 'N')
    assert.equal(directionFromYaw(undefined), null)
    assert.equal(directionBetween(origin, { x: 1, y: 4, z: -1 }), 'NE')
    assert.equal(directionBetween(origin, { x: -1, y: 0, z: 1 }), 'SW')
    assert.equal(directionBetween(origin, origin), null)
    assert.equal(relativeDirection(0, origin, { x: 1, y: 0, z: 0 }), 'RIGHT')
    assert.equal(relativeDirection(Math.PI / 2, origin, { x: 0, y: 0, z: -1 }), 'RIGHT')
    assert.equal(relativeDirection(0, origin, { x: -1, y: 0, z: 1 }), 'BACK_LEFT')
    assert.equal(relativeDirection(0, origin, origin), null)
})

test('status snapshot includes real player state and preserves zero values', () => {
    const detector = new StatusDetector({
        entity: { position: { x: 0, y: 64, z: 0 }, yaw: 0, pitch: 0 },
        health: 0, food: 0, oxygenLevel: 0,
        heldItem: { name: 'stone_pickaxe', count: 1 }, game: { gameMode: 'survival' }
    })
    assert.deepEqual(detector.getSnapshot(), {
        position: { x: 0, y: 64, z: 0 }, health: 0, food: 0, oxygen: 0,
        heldItem: 'stone_pickaxe', facing: { yaw: 0, pitch: 0, direction: 'N' }, gameMode: 'survival'
    })
})

test('status unavailable fields remain null rather than fabricated zeros', () => {
    const detector = new StatusDetector({ health: NaN })
    assert.deepEqual(detector.getSnapshot(), {
        position: null, health: null, food: null, oxygen: null, heldItem: null,
        facing: { yaw: null, pitch: null, direction: null }, gameMode: null
    })
})

test('look respects entityAtCursor result and keeps entity distance approximate', () => {
    let blockCalls = 0
    const detector = new LookDetector({
        entity: { position: { x: 0, y: 0, z: 0 } },
        entityAtCursor(range) {
            assert.equal(range, 6)
            return { id: 10, username: 'Roman', name: 'player', position: { x: 3, y: 0, z: 4 } }
        },
        blockAtCursor() { blockCalls++; return null }
    })
    assert.deepEqual(detector.getSnapshot(), {
        kind: 'entity', available: true, name: 'Roman', entityId: 10,
        distance: 5, distanceApproximate: true, position: { x: 3, y: 0, z: 4 }
    })
    assert.equal(blockCalls, 1)
})

test('look handles zero yaw/pitch in installed Mineflayer and does not see through walls', () => {
    for (const [yaw, pitch] of [[0, 0], [0, 0.1], [0.1, 0]]) {
        const origin = new Vec3(0, 64, 0)
        const direction = new Vec3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
        const eye = origin.offset(0, 1.62, 0)
        const intersection = eye.plus(direction.scaled(3))
        let raycasts = 0
        const bot = {
            username: 'Bot', entity: { position: origin, yaw, pitch, height: 1.8, eyeHeight: 1.62 },
            entities: { 2: { id: 2, name: 'zombie', type: 'mob', width: 0.6, height: 1.95,
                position: origin.plus(direction.scaled(5)) } },
            world: { raycast(position, view, range) {
                raycasts++
                assert.deepEqual(position, eye)
                assert.deepEqual({ ...view }, { ...direction })
                assert.equal(range, 6)
                return { name: 'stone', position: intersection.floored(), intersect: intersection }
            } }
        }
        rayTrace(bot)
        assert.equal(bot.blockAtCursor(6), null, 'installed native API rejects a zero angle')
        const target = new LookDetector(bot).getSnapshot()
        assert.equal(target.kind, 'block')
        assert.equal(target.name, 'stone')
        assert.ok(Math.abs(target.distance - 3) < 1e-10)
        assert.equal(target.distanceApproximate, false)
        assert.equal(raycasts, 1)
    }
})

test('look uses block ray intersection distance from the eye position', () => {
    const detector = new LookDetector({
        entity: { position: { x: 0, y: 64, z: 0 }, eyeHeight: 1.6 },
        entityAtCursor() { return null },
        blockAtCursor(range) {
            assert.equal(range, 6)
            return { name: 'coal_ore', position: { x: 0, y: 65, z: -5 }, intersect: { x: 0, y: 65.6, z: -4 } }
        }
    })
    assert.deepEqual(detector.getSnapshot(), {
        kind: 'block', available: true, name: 'coal_ore', distance: 4,
        distanceApproximate: false, position: { x: 0, y: 65, z: -5 }
    })
})

test('look falls back to approximate block position distance if no intersection exists', () => {
    const detector = new LookDetector({
        entity: { position: { x: 0, y: 0, z: 0 } },
        blockAtCursor() { return { name: 'stone', position: { x: 0, y: 0, z: -3 } } }
    })
    assert.equal(detector.getSnapshot().distance, 3)
    assert.equal(detector.getSnapshot().distanceApproximate, true)
})

test('look distinguishes no target from unavailable player or cursor APIs', () => {
    const ready = new LookDetector({
        entity: { position: { x: 0, y: 64, z: 0 } },
        entityAtCursor() { return null }, blockAtCursor() { return null }
    })
    assert.deepEqual(ready.getSnapshot(), {
        kind: 'none', available: true, name: null, distance: null, position: null
    })
    assert.equal(new LookDetector({}).getSnapshot().available, false)
    assert.equal(new LookDetector({ entity: { position: { x: 0, y: 0, z: 0 } } }).getSnapshot().available, false)
})

test('environment reads only adjacent loaded blocks and actual world properties', () => {
    const queried = []
    const detector = new EnvironmentDetector({
        entity: { position: { x: 4.8, y: 64, z: -2.2 }, yaw: 0 },
        blockAt(position) {
            queried.push(position)
            if (position.y === 63) return { name: 'grass_block' }
            if (position.y === 66) return { name: 'air' }
            if (position.z === -4) return { name: 'stone' }
            return { biome: 1, light: 0, skyLight: 15 }
        },
        registry: { biomes: { 1: { name: 'plains' } } },
        time: { timeOfDay: 0, isDay: true }, isRaining: false, rainState: 0, thunderState: 0,
        game: { dimension: 'overworld' }
    })
    assert.deepEqual(detector.getSnapshot(), {
        biome: 'plains', time: 0, isDay: true,
        weather: { raining: false, rainState: 0, thunderState: 0 },
        light: 0, skyLight: 15, groundBlock: 'grass_block', blockAhead: 'stone', blockAbove: 'air', dimension: 'overworld'
    })
    assert.deepEqual(queried, [
        { x: 4, y: 64, z: -3 }, { x: 4, y: 63, z: -3 },
        { x: 4, y: 66, z: -3 }, { x: 4, y: 64, z: -4 }
    ])
})

test('environment supports actual Biome objects and preserves Vec3 offsets', () => {
    class Point {
        constructor(x, y, z) { Object.assign(this, { x, y, z }) }
        floored() { return new Point(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)) }
        offset(x, y, z) { return new Point(this.x + x, this.y + y, this.z + z) }
    }
    const detector = new EnvironmentDetector({
        entity: { position: new Point(0.5, 64, 0.5), yaw: -Math.PI / 2 },
        blockAt(position) {
            assert.ok(position instanceof Point)
            return { name: 'air', biome: { id: 1, name: 'plains' }, light: 4, skyLight: 8 }
        }
    })
    assert.equal(detector.getSnapshot().biome, 'plains')
    assert.equal(detector.getSnapshot().light, 4)
})

test('environment handles unloaded chunks and unavailable fields without async world reads', () => {
    const detector = new EnvironmentDetector({
        entity: { position: { x: 0, y: 64, z: 0 }, yaw: 0 }, blockAt() { return null },
        world: { getBiome() { assert.fail('No asynchronous world scanning') } }
    })
    assert.deepEqual(detector.getSnapshot(), {
        biome: null, time: null, isDay: null, weather: { raining: null, rainState: null, thunderState: null },
        light: null, skyLight: null, groundBlock: null, blockAhead: null, blockAbove: null, dimension: null
    })
    assert.equal(new EnvironmentDetector({}).getSnapshot().biome, null)
})

test('active detectors publish normalized observations only when scanned', () => {
    for (const [Detector, type] of [
        [StatusDetector, 'status.snapshot'], [LookDetector, 'look.snapshot'], [EnvironmentDetector, 'environment.snapshot']
    ]) {
        const emitted = []
        const detector = new Detector({}, { emit(observation) { emitted.push(observation) } })
        detector.start()
        assert.equal(emitted.length, 0)
        const observation = detector.scan()
        assert.equal(observation.type, type)
        assert.equal(observation.priority, 'info')
        assert.equal(emitted[0], observation)
        assert.deepEqual(JSON.parse(JSON.stringify(observation)), observation)
        detector.stop()
        assert.equal(emitted.length, 1)
    }
})
