import NavigationService from '../services/NavigationService.js'

export default {
    name: 'follow',

    async execute({ bot, username, args, reply = message => bot.chat(message) }) {
        const targetName = args[0] || username
        const result = NavigationService.follow(bot, targetName)
        if (result.status === 'player_not_found') {
            reply(`I cannot see ${targetName}.`)
            return
        }
        reply(`Following ${targetName}.`)
    }
}
