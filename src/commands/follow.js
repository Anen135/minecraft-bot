import NavigationService from '../services/NavigationService.js'

export default {
    name: 'follow',

    async execute({ bot, username, args }) {
        const targetName = args[0] || username
        const result = NavigationService.follow(bot, targetName)
        if (result.status === 'player_not_found') {
            bot.chat(`I cannot see ${targetName}.`)
            return
        }
        bot.chat(`Following ${targetName}.`)
    }
}
