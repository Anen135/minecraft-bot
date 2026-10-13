import MiningService from '../services/MiningService.js'

export default {
    name: 'chop',

    async execute({ bot }) {
        const result = await MiningService.chopTree(bot, {
            onStart: count => bot.chat(`Chopping tree: ${count} blocks.`)
        })
        if (result.status === 'interrupted') return
        if (result.status === 'error') {
            bot.chat(result.code === 'no_log' ? result.message : `Could not chop tree: ${result.name}: ${result.message}`)
            return
        }
        bot.chat(result.completed === result.total ? 'Tree chopped successfully.' : `Chopped ${result.completed}/${result.total} blocks.`)
    }
}
