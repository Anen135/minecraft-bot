import { isInterrupted } from '../utils/pathErrors.js'

const SEARCH_DISTANCE = 32
const MAX_BLOCKS = 64
const MAX_VEIN_DISTANCE = 12

export default {
    name: 'chop',

    async execute({ bot }) {
        const block = bot.findBlock({
            matching: block => name => name.endsWith('_log') && !name.startsWith('stripped_'),
            maxDistance: SEARCH_DISTANCE
        })

        if (!block) {
            bot.chat('No log found nearby.')
            return
        }

        const tree = bot.collectBlock.findFromVein(block, MAX_BLOCKS, MAX_VEIN_DISTANCE)

        bot.chat(`Chopping tree... ${tree.length} blocks.`)

        try {
            await bot.collectBlock.collect(tree)
        } catch (error) {
            if (isInterrupted(error)) return
            console.error('[CHOP TREE]', error)
            bot.chat(`Could not chop tree: ${error.name}: ${error.message}`)
            return
        }

        // collect() also resolves when it was stopped or skipped unreachable blocks, so check what is left.
        const left = tree.filter(log => bot.blockAt(log.position)?.type === log.type).length

        bot.chat(left === 0
            ? 'Tree chopped successfully.'
            : `Chopped ${tree.length - left}/${tree.length} blocks.`)
    }
}
