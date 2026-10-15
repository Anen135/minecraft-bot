import NavigationService from '../services/NavigationService.js'

export default {
    name: 'stop',

    async execute({ bot, reply = message => bot.chat(message) }) {
        await NavigationService.stop(bot)
        reply('Stopped.')
    }
}
