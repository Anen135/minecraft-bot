import { interruptedErrors } from '../utils/pathErrors.js'

// MiningService — добыча/рубка блоков через mineflayer-collectblock.

export const SEARCH_DISTANCE = 32
export const MAX_BLOCKS = 64
export const MAX_VEIN_DISTANCE = 12

export function isChoppableLog(name) {
    return name.endsWith('_log') && !name.startsWith('stripped_')
}

export default class MiningService {
    constructor(bot) {
        this.bot = bot
    }

    // Найти ближайшее дерево и срубить его целиком (vein + collect).
    async chopTree() {
        const bot = this.bot

        const block = bot.findBlock({
            matching: b => isChoppableLog(b.name),
            maxDistance: SEARCH_DISTANCE
        })

        if (!block) {
            bot.chat('No log found nearby.')
            return false
        }

        const tree = bot.collectBlock.findFromVein(block, MAX_BLOCKS, MAX_VEIN_DISTANCE)

        bot.chat(`Chopping tree... ${tree.length} blocks.`)

        try {
            await bot.collectBlock.collect(tree)
        } catch (error) {
            // Прерывание (!stop или новая цель) — тихо выходим.
            if (interruptedErrors.includes(error?.name)) return false
            console.error('[CHOP TREE]', error)
            bot.chat(`Could not chop tree: ${error.name}: ${error.message}`)
            return false
        }

        const left = tree.filter(log => bot.blockAt(log.position)?.type === log.type).length

        bot.chat(left === 0 ? 'Tree chopped successfully.' : `Chopped ${tree.length - left}/${tree.length} blocks.`)
        return true
    }

    stop() {
        // collectBlock keeps looping while it has targets, even if pathfinding is stopped
        this.bot.collectBlock?.targets?.clear()
    }
}
