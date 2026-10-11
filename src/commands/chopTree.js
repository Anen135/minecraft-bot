import minecraftData from 'minecraft-data'

export default {
    name: 'chopTree',

    async execute({ bot }) {
        const mcData = minecraftData(bot.version)

        const logIds = [
            mcData.blocksByName.oak_log?.id,
            mcData.blocksByName.spruce_log?.id,
            mcData.blocksByName.birch_log?.id
        ].filter(Boolean)

        const block = bot.findBlock({
            matching: block => logIds.includes(block.type),
            maxDistance: 32
        })

        if (!block) {
            bot.chat('No log found nearby.')
            return
        }

        const tree = bot.collectBlock.findFromVein(block)

        bot.chat(`Chopping tree... ${tree.length} blocks.`)

        try {
            await bot.collectBlock.collect(tree)
            bot.chat('Tree chopped successfully.')
        } catch (err) {
            console.error('[CHOP TREE]', err)
            bot.chat( `Could not chop tree: ${err.name}: ${err.message}` )
        }
    }
}