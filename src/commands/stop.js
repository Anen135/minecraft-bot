import NavigationService from '../services/NavigationService.js'

export default {
    name: 'stop',

    async execute({ bot }) {
        await NavigationService.stop(bot)
        bot.chat('Stopped.')
    }
}
