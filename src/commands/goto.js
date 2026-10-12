import NavigationService from '../services/NavigationService.js'
import PlayerService from '../services/PlayerService.js'

// Тонкий интерфейс: разбор формы команды — в команде, навигация — в сервисе.
//
// !goto                 → идти к игроку, вызвавшему команду
// !goto <player>        → идти к указанному игроку
// !goto <x> <y> <z>     → идти к координатам

export function router(bot, username, args) {
    const players = new PlayerService(bot)

    // Форма A: без аргументов — позиция автора команды.
    if (args.length === 0) return players.getCoordinates(username)

    // Форма B: один аргумент — имя игрока.
    if (args.length === 1) return players.getCoordinates(args[0])

    // Форма C: три аргумента — координаты.
    if (args.length === 3) {
        const [x, y, z] = args.map(Number)
        // '' и whitespace превращаются в 0 — это некорректный ввод.
        if ([x, y, z].some(coord => isNaN(coord)) || args.some(arg => arg.trim() === '')) return null
        return [x, y, z]
    }

    return null
}

export default {
    name: 'goto',

    async execute({ bot, username, args }) {
        const coordinates = router(bot, username, args)
        if (!coordinates) {
            bot.chat('Usage: !goto x y z')
            return
        }
        const [x, y, z] = coordinates.map(Number)

        await new NavigationService(bot).goto(x, y, z)
    }
}
