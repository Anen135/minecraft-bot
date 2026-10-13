import MiningService from '../services/MiningService.js'

export default {
    name: 'mine',

    async execute({ bot, args = [] }) {
        const count = args.length === 2 ? Number(args[1]) : 1
        if (args.length < 1 || args.length > 2 || !args[0].trim() || (args.length === 2 && !args[1].trim()) || !Number.isSafeInteger(count) || count < 1) {
            bot.chat('Usage: !mine <block> [count]')
            return
        }
        const result = await MiningService.mine(bot, args[0], count)
        if (result.status === 'interrupted') return
        bot.chat(result.status === 'success' ? `Mined ${result.completed}/${result.requested} ${args[0]} blocks.` : `Could not mine: ${result.message}`)
    }
}
