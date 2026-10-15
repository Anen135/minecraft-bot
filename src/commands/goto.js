import NavigationService from '../services/NavigationService.js'

function _a(bot, username, args) {
    if (args.length != 0) return null
    const coords = bot.players?.[username]?.entity?.position
    if (!coords) return null
    return [ coords.x, coords.y, coords.z ]
}

function _b(bot, args) {
    if (args.length != 1) return null
    const coords = bot.players?.[args[0]]?.entity?.position
    if (!coords) return null
    return [ coords.x, coords.y, coords.z ]
}
function _c(args) {
    if (args.length != 3) return null
    if (args.some(coord => typeof coord !== 'string' || coord.trim() === '')) return null
    const [x, y, z] = args.slice(0, 3).map(Number)
    if (![x, y, z].every(Number.isFinite)) return null
    return [ x, y, z ]
}

function router(bot, username, args) {
    return _a(bot, username, args) || _b(bot, args) || _c(args)
}

export default {
    name: 'goto',

    async execute({ bot, username, args, reply = message => bot.chat(message) }) {
        const coordinates = router(bot, username, args)
        if (!coordinates) {
            reply('Usage: !goto x y z')
            return
        }
        const [x, y, z] = coordinates.map(Number)

        reply(`Going to ${x} ${y} ${z}`)

        const result = await NavigationService.goto(bot, x, y, z)
        if (result.status === 'arrived') reply('Arrived.')
        if (result.status === 'no_path') reply('No path to that position.')
    }
}
