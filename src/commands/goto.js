import pathfinder from 'mineflayer-pathfinder'
import { interruptedErrors } from '../utils/pathErrors.js'
const { goals } = pathfinder
const { GoalBlock } = goals

function fromSenderPosition(bot, username, args) {
    if (args.length !== 0) return null
    const coords = bot.players?.[username]?.entity?.position
    if (!coords) return null
    return [ coords.x, coords.y, coords.z ]
}

function fromPlayerName(bot, args) {
    if (args.length !== 1) return null
    const coords = bot.players?.[args[0]]?.entity?.position
    if (!coords) return null
    return [ coords.x, coords.y, coords.z ]
}

function fromCoordinates(args) {
    if (args.length !== 3) return null
    const [x, y, z] = args.map(Number)
    if ([x, y, z].some(coord => !Number.isFinite(coord))) return null
    return [ x, y, z ]
}

function resolveCoordinates(bot, username, args) {
    return fromSenderPosition(bot, username, args) || fromPlayerName(bot, args) || fromCoordinates(args)
}

export default {
    name: 'goto',

    async execute({ bot, username, args }) {
        const coordinates = resolveCoordinates(bot, username, args)
        if (!coordinates) {
            bot.chat('Usage: !goto x y z')
            return
        }
        const [x, y, z] = coordinates

        bot.chat(`Going to ${x} ${y} ${z}`)

        try {
            await bot.pathfinder.goto(new GoalBlock(x, y, z))
            bot.chat('Arrived.')
        } catch (error) {
            if (interruptedErrors.includes(error.name)) return
            if (error.name == 'NoPath') {
                bot.chat('No path to that position.')
                return
            }
            throw error
        }
    }
}
