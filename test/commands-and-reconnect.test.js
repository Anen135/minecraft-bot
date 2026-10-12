import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import BotManager from '../src/core/BotManager.js'
import chopTree from '../src/commands/chopTree.js'
import goto from '../src/commands/goto.js'
import stop from '../src/commands/stop.js'

const named = name => Object.assign(new Error(name), { name })

function fakeBot(overrides = {}) {
    const bot = { replies: [], chat(message) { bot.replies.push(message) }, ...overrides }
    return bot
}

test('chopTree reports success only when the whole tree is gone', async () => {
    const tree = [{ type: 5, position: 'a' }, { type: 5, position: 'b' }]
    let matching
    const make = remaining => fakeBot({
        findBlock(options) { matching = options.matching; return tree[0] },
        blockAt: position => remaining.includes(position) ? { type: 5 } : null,
        collectBlock: { findFromVein: () => tree, collect: async () => {} }
    })

    const done = make([])
    await chopTree.execute({ bot: done })
    assert.deepEqual(done.replies, ['Chopping tree: 2 blocks.', 'Tree chopped successfully.'])

    // the inline findBlock matcher accepts any wood log but not stripped logs or other blocks
    assert.equal(matching({ name: 'jungle_log' }), true)
    assert.equal(matching({ name: 'oak_log' }), true)
    assert.equal(matching({ name: 'stripped_jungle_log' }), false)
    assert.equal(matching({ name: 'oak_planks' }), false)

    // collect() resolves normally after !stop, but logs are still standing
    const stopped = make(['b'])
    await chopTree.execute({ bot: stopped })
    assert.equal(stopped.replies.at(-1), 'Chopped 1/2 blocks.')
})

test('chopTree reports real failures and missing trees', async t => {
    t.mock.method(console, 'error', () => {})
    const make = error => fakeBot({
        findBlock: () => ({ position: 'a' }),
        collectBlock: { findFromVein: () => [], collect: async () => { throw error } }
    })

    // interrupted errors are reported like any other failure (the early-return is commented out in the command)
    const interrupted = make(named('GoalChanged'))
    await chopTree.execute({ bot: interrupted })
    assert.match(interrupted.replies.at(-1), /^Could not chop tree: GoalChanged/)

    const failed = make(named('NoPath'))
    await chopTree.execute({ bot: failed })
    assert.match(failed.replies.at(-1), /^Could not chop tree: NoPath/)

    const none = fakeBot({ findBlock: () => null })
    await chopTree.execute({ bot: none })
    assert.deepEqual(none.replies, ['No log found nearby.'])
})

test('goto validates arguments and handles pathfinder outcomes', async () => {
    // fake player registry: "Steve" has an entity, others do not
    const players = { Steve: { entity: { position: { x: 10.5, y: 64, z: -3.25 } } } }
    const make = goto => fakeBot({ players, pathfinder: { goto } })

    // wrong argument count, or a non-numeric coordinate -> usage hint
    for (const args of [[], ['1', '2'], ['1', '2', 'x'], ['a', 'b', 'c']]) {
        const bot = make(async () => assert.fail('must not navigate'))
        await goto.execute({ bot, username: 'Alex', args })
        assert.deepEqual(bot.replies, ['Usage: !goto x y z'], JSON.stringify(args))
    }

    const ok = make(async () => {})
    await goto.execute({ bot: ok, username: 'Alex', args: ['1', '2', '3'] })
    assert.deepEqual(ok.replies, ['Going to 1 2 3', 'Arrived.'])

    // no args -> walk to the sender's own position
    const me = make(async () => {})
    await goto.execute({ bot: me, username: 'Steve', args: [] })
    assert.deepEqual(me.replies, ['Going to 10.5 64 -3.25', 'Arrived.'])

    // one arg -> walk to that player's position; unknown player -> usage hint
    const friend = make(async () => {})
    await goto.execute({ bot: friend, username: 'Alex', args: ['Steve'] })
    assert.deepEqual(friend.replies, ['Going to 10.5 64 -3.25', 'Arrived.'])

    const ghost = make(async () => assert.fail('must not navigate'))
    await goto.execute({ bot: ghost, username: 'Alex', args: ['Nobody'] })
    assert.deepEqual(ghost.replies, ['Usage: !goto x y z'])

    for (const name of ['PathStopped', 'GoalChanged']) {
        const bot = make(async () => { throw named(name) })
        await goto.execute({ bot, username: 'Alex', args: ['1', '2', '3'] })
        assert.deepEqual(bot.replies, ['Going to 1 2 3'], name)
    }

    const noPath = make(async () => { throw named('NoPath') })
    await goto.execute({ bot: noPath, username: 'Alex', args: ['1', '2', '3'] })
    assert.equal(noPath.replies.at(-1), 'No path to that position.')

    const broken = make(async () => { throw new Error('boom') })
    await assert.rejects(goto.execute({ bot: broken, username: 'Alex', args: ['1', '2', '3'] }), /boom/)
})

test('stop cancels collecting, pathfinding and movement', async () => {
    const calls = []
    const bot = fakeBot({
        collectBlock: { targets: { clear: () => calls.push('targets') } },
        pathfinder: { stop: () => calls.push('pathfinder') },
        clearControlStates: () => calls.push('controls')
    })
    await stop.execute({ bot })
    assert.deepEqual(calls, ['targets', 'pathfinder', 'controls'])
    assert.deepEqual(bot.replies, ['Stopped.'])

    // works when the collectBlock plugin is not loaded
    const plain = fakeBot({ pathfinder: { stop() {} }, clearControlStates() {} })
    await stop.execute({ bot: plain })
    assert.deepEqual(plain.replies, ['Stopped.'])
})

test('BotManager reconnects with growing delay until stopped', async t => {
    t.mock.method(console, 'log', () => {})
    const bots = []
    const createBot = () => {
        const bot = Object.assign(new EventEmitter(), { loadPlugin() {}, quit() {} })
        bots.push(bot)
        return bot
    }
    const manager = new BotManager({ minecraft: {} }, { createBot, reconnect: { min: 20, max: 40 } })
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

    manager.start()
    assert.equal(bots.length, 1)

    bots[0].emit('end', 'kicked')
    bots[0].emit('end', 'duplicate event is ignored')
    assert.equal(bots.length, 1)
    await sleep(60)
    assert.equal(bots.length, 2)
    assert.equal(manager.bot, bots[1])
    assert.equal(manager.reconnectDelay, 40)

    bots[1].emit('end', 'closed')
    await sleep(100)
    assert.equal(bots.length, 3)
    assert.equal(manager.reconnectDelay, 40, 'delay is capped')

    bots[2].emit('end', 'closed')
    manager.stop()
    await sleep(100)
    assert.equal(bots.length, 3, 'no reconnect after stop()')
})
