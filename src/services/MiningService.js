import { interruptedErrors } from '../utils/pathErrors.js'

const SEARCH_DISTANCE = 32
const MAX_TREE_BLOCKS = 64
const MAX_VEIN_DISTANCE = 12

function failure(error) {
    if (interruptedErrors.includes(error?.name) || error?.message === 'Digging aborted') {
        return { status: 'interrupted' }
    }
    return {
        status: 'error',
        code: error?.name === 'NoPath' ? 'no_path' : 'mining_failed',
        name: error?.name || 'Error',
        message: error?.message || String(error)
    }
}

export default class MiningService {
    static async chopTree(bot, { onStart } = {}) {
        try {
            const block = bot.findBlock({
                matching: block => typeof block.name === 'string' && block.name.endsWith('_log') && !block.name.startsWith('stripped_'),
                maxDistance: SEARCH_DISTANCE
            })
            if (!block) return { status: 'error', code: 'no_log', message: 'No log found nearby.' }

            const tree = bot.collectBlock.findFromVein(block, MAX_TREE_BLOCKS, MAX_VEIN_DISTANCE)
            onStart?.(tree.length)
            await bot.collectBlock.collect(tree)
            const completed = tree.filter(block => bot.blockAt(block.position)?.type !== block.type).length
            return { status: 'success', total: tree.length, completed }
        } catch (error) {
            return failure(error)
        }
    }

    static async mine(bot, blockName, count = 1) {
        if (!Number.isSafeInteger(count) || count < 1) {
            return { status: 'error', code: 'invalid_count', message: 'Count must be a positive integer.' }
        }
        try {
            const blockType = bot.registry.blocksByName[blockName]
            if (!blockType) return { status: 'error', code: 'unknown_block', message: `Unknown block: ${blockName}.` }

            const positions = bot.findBlocks({ matching: blockType.id, maxDistance: SEARCH_DISTANCE, count })
            const blocks = positions.map(position => bot.blockAt(position)).filter(block => block?.type === blockType.id)
            if (!blocks.length) {
                return { status: 'error', code: 'no_block', message: `No ${blockName} found nearby.` }
            }

            await bot.collectBlock.collect(blocks)
            const completed = blocks.filter(block => bot.blockAt(block.position)?.type !== block.type).length
            return { status: 'success', requested: count, total: blocks.length, completed }
        } catch (error) {
            return failure(error)
        }
    }
}
