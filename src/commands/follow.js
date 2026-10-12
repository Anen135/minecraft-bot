import NavigationService from '../services/NavigationService.js'

// Тонкий интерфейс: выбор цели (свой ник или аргумент) — здесь, следование — в сервисе.
//
// !follow            → следовать за вызвавшим команду
// !follow <player>   → следовать за указанным игроком

export default {
    name: 'follow',

    async execute({ bot, username, args }) {
        const targetName = args[0] || username
        await new NavigationService(bot).follow(targetName)
    }
}
