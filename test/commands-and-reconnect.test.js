import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import BotManager from '../src/core/BotManager.js'
import chopTree from '../src/commands/chopTree.js'
import goto, { router } from '../src/commands/goto.js'
import stop from '../src/commands/stop.js'
import { isChoppableLog } from '../src/services/MiningService.js'

const named = name => Object.assign(new Error(name), { name })

function fakeBot(overrides = {}) {
    const bot = { replies: [], chat(message) { bot.replies.push(message) }, ...overrides }
    return bot
}

test('isChoppableLog accepts any wood log but not stripped logs or other blocks', () => {
    for (const name of ['oak_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'])
        assert.equal(isChoppableLog(name), true, name)
    for (const name of ['stripped_oak_log', 'oak_planks', 'oak_leaves', 'crimson_stem', 'stone'])
        assert.equal(isChoppableLog(name), false, name)
})

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
    assert.deepEqual(done.replies, ['Chopping tree... 2 blocks.', 'Tree chopped successfully.'])
    assert.equal(matching({ name: 'jungle_log' }), true)
    assert.equal(matching({ name: 'stripped_jungle_log' }), false)

    // collect() resolves normally after !stop, but logs are still standing
    const stopped = make(['b'])
    await chopTree.execute({ bot: stopped })
    assert.equal(stopped.replies.at(-1), 'Chopped 1/2 blocks.')
})

test('chopTree stays quiet when interrupted and reports real failures', async t => {
    t.mock.method(console, 'error', () => {})
    const make = error => fakeBot({
        findBlock: () => ({ position: 'a' }),
        collectBlock: { findFromVein: () => [], collect: async () => { throw error } }
    })

    const interrupted = make(named('GoalChanged'))
    await chopTree.execute({ bot: interrupted })
    assert.deepEqual(interrupted.replies, ['Chopping tree... 0 blocks.'])

    const failed = make(named('NoPath'))
    await chopTree.execute({ bot: failed })
    assert.match(failed.replies.at(-1), /^Could not chop tree: NoPath/)

    const none = fakeBot({ findBlock: () => null })
    await chopTree.execute({ bot: none })
    assert.deepEqual(none.replies, ['No log found nearby.'])
})

test('goto validates arguments and handles pathfinder outcomes', async () => {
    const make = gotoFn => fakeBot({
        username: 'TestBot',
        players: {},
        pathfinder: { goto: gotoFn }
    })

    for (const args of [[], ['1', '2'], ['1', '2', 'x'], ['1', '', '3']]) {
        const bot = make(async () => assert.fail('must not navigate'))
        await goto.execute({ bot, username: 'Alice', args })
        assert.deepEqual(bot.replies, ['Usage: !goto x y z'], JSON.stringify(args))
    }

    const ok = make(async () => {})
    await goto.execute({ bot: ok, args: ['1', '2', '3'] })
    assert.deepEqual(ok.replies, ['Going to 1 2 3', 'Arrived.'])

    for (const name of ['PathStopped', 'GoalChanged']) {
        const bot = make(async () => { throw named(name) })
        await goto.execute({ bot, args: ['1', '2', '3'] })
        assert.deepEqual(bot.replies, ['Going to 1 2 3'], name)
    }

    const noPath = make(async () => { throw named('NoPath') })
    await goto.execute({ bot: noPath, args: ['1', '2', '3'] })
    assert.equal(noPath.replies.at(-1), 'No path to that position.')

    const broken = make(async () => { throw new Error('boom') })
    await assert.rejects(goto.execute({ bot: broken, args: ['1', '2', '3'] }), /boom/)
})

test('goto router selects the right command form', () => {
    const pos = (x, y, z) => ({ x, y, z })
    const bot = fakeBot({
        players: {
            Alice: { entity: { position: pos(10, 20, 30) } },
            Bob: { entity: { position: pos(1, 2, 3) } },
            Ghost: {}
        }
    })

    // !goto → позиция автора команды
    assert.deepEqual(router(bot, 'Alice', []), [10, 20, 30])
    // !goto <player> → позиция указанного игрока
    assert.deepEqual(router(bot, 'Alice', ['Bob']), [1, 2, 3])
    // !goto <x> <y> <z> → координаты
    assert.deepEqual(router(bot, 'Alice', ['5', '-6.5', '7']), [5, -6.5, 7])

    // некорректные формы
    assert.equal(router(bot, 'Nobody', []), null)      // автора не видно
    assert.equal(router(bot, 'Alice', ['Ghost']), null) // игрок без entity
    assert.equal(router(bot, 'Alice', ['1', '2']), null)
    assert.equal(router(bot, 'Alice', ['1', '2', 'x']), null)
    assert.equal(router(bot, 'Alice', ['1', '', '3']), null)
    assert.equal(router(bot, 'Alice', ['1', '2', '3', '4']), null)
})

test('goto routes player forms through NavigationService', async () => {
    const destinations = []
    const make = () => fakeBot({
        username: 'TestBot',
        players: {
            Alice: { entity: { position: { x: 10, y: 20, z: 30 } } },
            Bob: { entity: { position: { x: 1, y: 2, z: 3 } } }
        },
        pathfinder: { goto: async goal => { destinations.push([goal.x, goal.y, goal.z]) } }
    })

    const self = make()
    await goto.execute({ bot: self, username: 'Alice', args: [] })
    assert.deepEqual(destinations.at(-1), [10, 20, 30])
    assert.deepEqual(self.replies, ['Going to 10 20 30', 'Arrived.'])

    const other = make()
    await goto.execute({ bot: other, username: 'Alice', args: ['Bob'] })
    assert.deepEqual(destinations.at(-1), [1, 2, 3])
    assert.deepEqual(other.replies, ['Going to 1 2 3', 'Arrived.'])
})

test('follow uses a dynamic GoalFollow on the target entity', async () => {
    const follow = (await import('../src/commands/follow.js')).default
    let goal
    const bot = fakeBot({
        players: { Bob: { entity: { position: { x: 1, y: 2, z: 3 } } } },
        pathfinder: { setGoal: (g, dynamic) => { goal = { g, dynamic } } }
    })

    await follow.execute({ bot, username: 'Alice', args: ['Bob'] })
    assert.equal(goal.g.constructor.name, 'GoalFollow')
    assert.equal(goal.dynamic, true)
    assert.deepEqual(bot.replies, ['Following Bob.'])

    const unseen = fakeBot({ players: {}, pathfinder: { setGoal() { assert.fail('must not set goal') } } })
    await follow.execute({ bot: unseen, username: 'Alice', args: ['Ghost'] })
    assert.deepEqual(unseen.replies, ['I cannot see Ghost.'])
})

test('inventory formats items and truncates long lists', async () => {
    const inventory = (await import('../src/commands/inventory.js')).default
    const item = (name, count) => ({ name, count })

    const empty = fakeBot({ inventory: { items: () => [] } })
    await inventory.execute({ bot: empty })
    assert.deepEqual(empty.replies, ['Inventory is empty.'])

    const full = fakeBot({ inventory: { items: () => [item('oak_log', 3), item('stone', 64)] } })
    await inventory.execute({ bot: full })
    assert.deepEqual(full.replies, ['oak_log x3, stone x64'])

    const long = fakeBot({ inventory: { items: () => Array.from({ length: 40 }, (_, i) => item(`item_${i}`, 1)) } })
    await inventory.execute({ bot: long })
    assert.equal(long.replies[0].length, 240)
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
