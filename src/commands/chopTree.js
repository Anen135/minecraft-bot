import minecraftData from 'minecraft-data'

export default {
    name: 'chop',

    async execute({ bot }) {
        const mcData = minecraftData(bot.version)


        const block = bot.findBlock({
            matching: block => block.name.endsWith('_log'),
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