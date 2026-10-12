import MiningService from '../services/MiningService.js'
import NavigationService from '../services/NavigationService.js'

// Интерфейс: !stop останавливает все текущие действия бота — механика в сервисах.

export default {
    name: 'stop',

    async execute({ bot }) {
        new MiningService(bot).stop()
        new NavigationService(bot).stop()
        bot.chat('Stopped.')
    }
}
