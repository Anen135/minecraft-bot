import assert from 'node:assert/strict'
import { test } from 'node:test'
import MiningService from '../src/services/MiningService.js'
import InventoryService from '../src/services/InventoryService.js'
import CraftingService from '../src/services/CraftingService.js'
import chop from '../src/commands/chopTree.js'
import inventory from '../src/commands/inventory.js'
import mine from '../src/commands/mine.js'
import equip from '../src/commands/equip.js'
import craft from '../src/commands/craft.js'

const named = name => Object.assign(new Error(name), { name })

function chatBot(overrides = {}) {
    return { replies: [], chat(message) { this.replies.push(message) }, ...overrides }
}

test('log predicate and chopping preserve search limits, progress and partial completion', async () => {
    const tree = [{ type: 1, position: 'a' }, { type: 1, position: 'b' }]
    const bot = {
        findBlock(options) {
            assert.equal(options.maxDistance, 32)
            for (const name of ['oak_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'])
                assert.equal(options.matching({ name }), true, name)
            for (const name of ['stripped_oak_log', 'oak_planks', 'oak_leaves', 'crimson_stem', 'stone', undefined])
                assert.equal(options.matching({ name }), false, name)
            return tree[0]
        },
        collectBlock: {
            findFromVein(block, count, distance) {
                assert.equal(block, tree[0])
                assert.equal(count, 64)
                assert.equal(distance, 12)
                return tree
            },
            async collect(blocks) { assert.equal(blocks, tree) }
        },
        blockAt: position => position === 'b' ? tree[1] : null
    }
    let started
    assert.deepEqual(await MiningService.chopTree(bot, { onStart: count => { started = count } }),
        { status: 'success', total: 2, completed: 1 })
    assert.equal(started, 2)
    assert.equal((await MiningService.chopTree({ findBlock: () => null })).code, 'no_log')
})

test('mining looks up block names and reports requested quantity separately from available targets', async () => {
    const blocks = [{ type: 2, position: 'a' }, { type: 2, position: 'b' }]
    let collected = false
    const bot = {
        registry: { blocksByName: { stone: { id: 2 } } },
        findBlocks(options) {
            assert.deepEqual(options, { matching: 2, maxDistance: 32, count: 3 })
            return ['a', 'b']
        },
        blockAt(position) { return collected ? null : blocks.find(block => block.position === position) },
        collectBlock: { async collect(targets) { assert.deepEqual(targets, blocks); collected = true } }
    }
    assert.deepEqual(await MiningService.mine(bot, 'stone', 3),
        { status: 'success', requested: 3, total: 2, completed: 2 })
    assert.equal((await MiningService.mine(bot, 'unknown')).code, 'unknown_block')
    assert.equal((await MiningService.mine(bot, 'stone', 0)).code, 'invalid_count')
    bot.findBlocks = () => []
    assert.equal((await MiningService.mine(bot, 'stone')).code, 'no_block')
})

test('mining normalizes navigation failures and intentional interruptions', async () => {
    for (const error of [named('NoPath'), named('GoalChanged'), named('PathStopped'), new Error('Digging aborted'), new Error('tool unavailable')]) {
        const bot = {
            findBlock: () => ({ type: 1 }),
            collectBlock: { findFromVein: () => [], async collect() { throw error } }
        }
        const result = await MiningService.chopTree(bot)
        if (error.name === 'NoPath') {
            assert.equal(result.code, 'no_path')
            assert.equal(result.name, 'NoPath')
        } else if (error.message === 'tool unavailable') {
            assert.equal(result.code, 'mining_failed')
            assert.equal(result.message, 'tool unavailable')
        } else assert.equal(result.status, 'interrupted')
    }
})

test('chop command only formats service progress and outcome', async t => {
    t.mock.method(MiningService, 'chopTree', async (bot, { onStart }) => {
        onStart(4)
        return { status: 'success', total: 4, completed: 2 }
    })
    const bot = chatBot()
    await chop.execute({ bot })
    assert.deepEqual(bot.replies, ['Chopping tree: 4 blocks.', 'Chopped 2/4 blocks.'])
})

test('inventory returns plain item data and preserves empty/truncated command output', async () => {
    const items = [{ type: 1, name: 'stone', count: 4 }]
    const bot = chatBot({ inventory: { items: () => items } })
    assert.deepEqual(InventoryService.list(bot), { status: 'success', items: [{ name: 'stone', count: 4 }] })
    await inventory.execute({ bot })
    assert.deepEqual(bot.replies, ['stone x4'])
    items.length = 0
    await inventory.execute({ bot })
    assert.equal(bot.replies.at(-1), 'Inventory is empty.')
    items.push({ name: 'x'.repeat(250), count: 1 })
    await inventory.execute({ bot })
    assert.equal(bot.replies.at(-1).length, 240)
})

test('equip uses the current bot inventory, forwards destination and normalizes failures', async () => {
    const item = { type: 5, name: 'iron_helmet', count: 1 }
    const bot = {
        registry: { itemsByName: { iron_helmet: { id: 5 } } },
        inventory: { items: () => [item] },
        async equip(actual, destination) { assert.equal(actual, item); assert.equal(destination, 'head') }
    }
    assert.deepEqual(await InventoryService.equip(bot, 'iron_helmet', 'head'),
        { status: 'success', itemName: 'iron_helmet', destination: 'head' })
    assert.equal((await InventoryService.equip(bot, 'unknown')).code, 'unknown_item')
    assert.equal((await InventoryService.equip(bot, 'iron_helmet', 'unknown')).code, 'invalid_destination')
    bot.inventory.items = () => []
    assert.equal((await InventoryService.equip(bot, 'iron_helmet')).code, 'missing_item')
    bot.inventory.items = () => [item]
    bot.equip = async () => { throw new Error('slot unavailable') }
    assert.equal((await InventoryService.equip(bot, 'iron_helmet')).message, 'slot unavailable')
})

function craftingBot(overrides = {}) {
    return {
        registry: { itemsByName: { oak_planks: { id: 5 } }, blocksByName: { crafting_table: { id: 10 } } },
        findBlock: () => null,
        recipesFor: () => [],
        recipesAll: () => [],
        craft: async () => assert.fail('must not craft'),
        ...overrides
    }
}

test('craft count means output items and rounds to full recipe iterations', async () => {
    const recipe = { result: { count: 4 }, requiresTable: false }
    const bot = craftingBot({
        recipesFor(id, metadata, count, table) {
            assert.deepEqual([id, metadata, count, table], [5, null, 5, null])
            return [recipe]
        },
        findBlock: () => assert.fail('inventory recipe needs no table'),
        async craft(actual, iterations, table) {
            assert.equal(actual, recipe)
            assert.equal(iterations, 2)
            assert.equal(table, null)
        }
    })
    assert.deepEqual(await CraftingService.craft(bot, 'oak_planks', 5),
        { status: 'success', itemName: 'oak_planks', count: 8 })
})

test('craft uses an existing nearby table only when inventory crafting is unavailable', async () => {
    const table = { type: 10 }
    const recipe = { result: { count: 1 }, requiresTable: true }
    const bot = craftingBot({
        findBlock(options) { assert.deepEqual(options, { matching: 10, maxDistance: 4 }); return table },
        recipesFor(id, metadata, count, actualTable) { return actualTable === table ? [recipe] : [] },
        async craft(actualRecipe, count, actualTable) {
            assert.equal(actualRecipe, recipe)
            assert.equal(count, 1)
            assert.equal(actualTable, table)
        }
    })
    assert.equal((await CraftingService.craft(bot, 'oak_planks')).status, 'success')
})

test('craft distinguishes unknown items, invalid count, unavailable recipes, resources and execution failures', async () => {
    const bot = craftingBot()
    assert.equal((await CraftingService.craft(bot, 'unknown')).code, 'unknown_item')
    for (const count of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        assert.equal((await CraftingService.craft(bot, 'oak_planks', count)).code, 'invalid_count')
    }
    assert.equal((await CraftingService.craft(bot, 'oak_planks')).code, 'no_recipe')
    bot.recipesAll = () => [{}]
    assert.equal((await CraftingService.craft(bot, 'oak_planks')).code, 'missing_resources')
    bot.recipesFor = () => [{ result: { count: 4 } }]
    bot.craft = async () => { throw new Error('window closed') }
    assert.equal((await CraftingService.craft(bot, 'oak_planks')).message, 'window closed')
})

test('mine and craft commands reject invalid syntax before calling services', async t => {
    t.mock.method(MiningService, 'mine', async () => assert.fail('must not mine'))
    t.mock.method(CraftingService, 'craft', async () => assert.fail('must not craft'))
    for (const command of [mine, craft]) {
        for (const args of [[], ['stone', '0'], ['stone', '-1'], ['stone', '1.5'], ['stone', 'NaN'], ['stone', 'Infinity'], ['stone', ''], ['stone', '1', 'extra']]) {
            const bot = chatBot()
            await command.execute({ bot, args })
            assert.match(bot.replies[0], /^Usage:/)
        }
    }
})

test('manual commands parse counts, default equipment slot and call independent services', async t => {
    const bot = chatBot()
    t.mock.method(MiningService, 'mine', async (actualBot, name, count) => {
        assert.equal(actualBot, bot)
        assert.equal(name, 'stone')
        assert.equal(count, 2)
        return { status: 'success', requested: count, completed: count }
    })
    t.mock.method(CraftingService, 'craft', async (actualBot, name, count) => {
        assert.equal(actualBot, bot)
        assert.equal(name, 'oak_planks')
        assert.equal(count, 1)
        return { status: 'success', count: 4 }
    })
    t.mock.method(InventoryService, 'equip', async (actualBot, name, destination) => {
        assert.equal(actualBot, bot)
        assert.equal(name, 'iron_pickaxe')
        assert.equal(destination, 'hand')
        return { status: 'success' }
    })
    await mine.execute({ bot, args: ['stone', '2'] })
    await craft.execute({ bot, args: ['oak_planks'] })
    await equip.execute({ bot, args: ['iron_pickaxe'] })
    assert.deepEqual(bot.replies, ['Mined 2/2 stone blocks.', 'Crafted 4 oak_planks.', 'Equipped iron_pickaxe in hand.'])
})

test('commands show normalized errors and stay quiet on mining interruptions', async t => {
    t.mock.method(MiningService, 'mine', async () => ({ status: 'interrupted' }))
    t.mock.method(InventoryService, 'equip', async () => ({ status: 'error', message: 'No sword in inventory.' }))
    t.mock.method(CraftingService, 'craft', async () => ({ status: 'error', message: 'Not enough resources.' }))
    const bot = chatBot()
    await mine.execute({ bot, args: ['stone'] })
    assert.deepEqual(bot.replies, [])
    await equip.execute({ bot, args: ['iron_sword'] })
    await craft.execute({ bot, args: ['oak_planks'] })
    assert.deepEqual(bot.replies, ['Could not equip: No sword in inventory.', 'Could not craft: Not enough resources.'])
})

test('equip command rejects unsupported destinations without invoking the service', async t => {
    t.mock.method(InventoryService, 'equip', async () => assert.fail('must not equip'))
    for (const args of [[], ['stone', 'belt'], ['stone', 'hand', 'extra']]) {
        const bot = chatBot()
        await equip.execute({ bot, args })
        assert.match(bot.replies[0], /^Usage: !equip/)
    }
})
