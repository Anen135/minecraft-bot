import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { CollectBlock } from 'mineflayer-collectblock/lib/CollectBlock.js'
import pathfinder from 'mineflayer-pathfinder'
import NavigationService from '../src/services/NavigationService.js'
import goto from '../src/commands/goto.js'
import follow from '../src/commands/follow.js'
import stop from '../src/commands/stop.js'

const named = name => Object.assign(new Error(name), { name })

test('goto command preserves caller, player and coordinate routing through the service', async t => {
    const calls = []
    t.mock.method(NavigationService, 'goto', async (...args) => {
        calls.push(args)
        return { status: 'arrived' }
    })
    const replies = []
    const bot = {
        players: {
            Alice: { entity: { position: { x: 1, y: 64, z: 3 } } },
            Steve: { entity: { position: { x: 10, y: 65, z: -20 } } }
        },
        chat: message => replies.push(message)
    }

    for (const args of [[], ['Steve'], ['100', '64', '-200']]) {
        await goto.execute({ bot, username: 'Alice', args })
    }

    assert.deepEqual(calls, [[bot, 1, 64, 3], [bot, 10, 65, -20], [bot, 100, 64, -200]])
    assert.deepEqual(replies, ['Going to 1 64 3', 'Arrived.',
        'Going to 10 65 -20', 'Arrived.', 'Going to 100 64 -200', 'Arrived.'])
})

test('goto command rejects invalid input and unavailable players without invoking navigation', async t => {
    t.mock.method(NavigationService, 'goto', () => assert.fail('must not navigate'))
    const replies = []
    const bot = { players: {}, chat: message => replies.push(message) }
    const invalid = [[], ['Missing'], ['1', '2'], ['1', '2', 'oops'],
        ['1', '', '3'], ['1', '   ', '3'], ['1', 'Infinity', '3'],
        ['1', 'NaN', '3'], ['1', '2', '3', '4']]
    for (const args of invalid) {
        await goto.execute({ bot, username: 'Alice', args })
    }
    assert.deepEqual(replies, invalid.map(() => 'Usage: !goto x y z'))
})

test('NavigationService.goto constructs a GoalBlock and accepts the current bot each time', async () => {
    const calls = []
    const make = id => ({ pathfinder: { async goto(goal) { calls.push([id, goal]) } } })
    for (const id of ['before-reconnect', 'after-reconnect']) {
        assert.deepEqual(await NavigationService.goto(make(id), 10, 64, -20), { status: 'arrived' })
    }
    assert.deepEqual(calls.map(([id]) => id), ['before-reconnect', 'after-reconnect'])
    for (const [, goal] of calls) {
        assert.ok(goal instanceof pathfinder.goals.GoalBlock)
        assert.deepEqual([goal.x, goal.y, goal.z], [10, 64, -20])
    }
})

test('NavigationService.goto normalizes NoPath and intentional interruptions, preserving unexpected failures', async () => {
    for (const [name, status] of [['NoPath', 'no_path'], ['PathStopped', 'interrupted'], ['GoalChanged', 'interrupted']]) {
        const bot = { pathfinder: { async goto() { throw named(name) } } }
        assert.deepEqual(await NavigationService.goto(bot, 1, 2, 3), { status })
    }
    const error = new Error('network failure')
    await assert.rejects(NavigationService.goto({ pathfinder: { async goto() { throw error } } }, 1, 2, 3),
        failure => failure === error)
    for (const x of [NaN, Infinity, -Infinity, '1', undefined]) {
        await assert.rejects(NavigationService.goto({}, x, 2, 3), /finite numbers/)
    }
})

test('follow preserves caller/player forms and the dynamic GoalFollow distance', async () => {
    const calls = []
    const replies = []
    const alice = { position: {} }
    const steve = { position: {} }
    const bot = {
        players: { Alice: { entity: alice }, Steve: { entity: steve } },
        pathfinder: { setGoal: (...args) => calls.push(args) },
        chat: message => replies.push(message)
    }
    await follow.execute({ bot, username: 'Alice', args: [] })
    await follow.execute({ bot, username: 'Alice', args: ['Steve'] })
    await follow.execute({ bot, username: 'Alice', args: ['Missing'] })
    assert.equal(calls.length, 2)
    for (const [index, [goal, dynamic]] of calls.entries()) {
        assert.ok(goal instanceof pathfinder.goals.GoalFollow)
        assert.equal(goal.entity, index === 0 ? alice : steve)
        assert.equal(goal.rangeSq, 4)
        assert.equal(dynamic, true)
    }
    assert.deepEqual(replies, ['Following Alice.', 'Following Steve.', 'I cannot see Missing.'])
    assert.deepEqual(NavigationService.follow({}, 'Missing'), { status: 'player_not_found' })
})

test('stop immediately clears collection targets, goal, digging and controls without waiting for item pickup', { timeout: 1000 }, async () => {
    const calls = []
    const stalledCancellation = new Promise(() => {})
    const bot = {
        collectBlock: {
            cancelTask() { calls.push('cancel'); return stalledCancellation },
            targets: { clear() { calls.push('targets') } }
        },
        pathfinder: {
            stop() { calls.push('pathfinder') },
            setGoal(goal) { calls.push(['goal', goal]) }
        },
        targetDigBlock: {},
        stopDigging() { calls.push('dig') },
        clearControlStates() { calls.push('controls') }
    }
    assert.deepEqual(await NavigationService.stop(bot), { status: 'stopped' })
    assert.deepEqual(calls, ['targets', 'pathfinder', ['goal', null], 'dig', 'controls'])
})

test('stop works without collectBlock and does not require active digging', async () => {
    const calls = []
    assert.deepEqual(await NavigationService.stop({
        pathfinder: { stop() { calls.push('pathfinder') } },
        clearControlStates() { calls.push('controls') },
        stopDigging() { assert.fail('nothing is being dug') }
    }), { status: 'stopped' })
    assert.deepEqual(calls, ['pathfinder', 'controls'])
})

test('stop command replies while the installed collectBlock plugin waits for entityGone', { timeout: 1000 }, async () => {
    class Entity {}
    const item = Object.assign(new Entity(), { isValid: true, position: { x: 1, y: 64, z: 3 } })
    const bot = Object.assign(new EventEmitter(), {
        tool: {},
        inventory: { emptySlotCount: () => 1 },
        pathfinder: { async goto() {}, stop() {}, setGoal() {} },
        clearControlStates() {},
        replies: [],
        chat(message) { this.replies.push(message) }
    })
    let target = null
    // Keep the plugin's actual collection/cancellation code, without world initialization.
    bot.collectBlock = Object.assign(Object.create(CollectBlock.prototype), {
        bot,
        movements: null,
        chestLocations: [],
        itemFilter: () => true,
        targets: {
            get empty() { return target === null },
            appendTarget(value) { target = value },
            getClosest() { return target },
            clear() { target = null },
            removeTarget() { target = null }
        }
    })
    const collection = bot.collectBlock.collect(item)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(bot.listenerCount('entityGone'), 1)

    try {
        await stop.execute({ bot })
        assert.deepEqual(bot.replies, ['Stopped.'])
        assert.equal(bot.collectBlock.targets.empty, true)
    } finally {
        bot.emit('entityGone', item)
        await collection
    }
})
