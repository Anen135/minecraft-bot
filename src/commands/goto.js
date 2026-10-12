import pathfinder from 'mineflayer-pathfinder'
import { isInterrupted, isNoPath } from '../utils/pathErrors.js'
const { goals } = pathfinder
const { GoalBlock } = goals

export default {
    name: 'goto',

    async execute({ bot, args }) {
        const coordinates = args.slice(0, 3)
        if (coordinates.length < 3 || !coordinates.every(value => /^-?\d+(\.\d+)?$/.test(value))) {
            bot.chat('Usage: !goto x y z')
            return
        }

        const [x, y, z] = coordinates.map(Number)

        bot.chat(`Going to ${x} ${y} ${z}`)

        try {
            await bot.pathfinder.goto(new GoalBlock(x, y, z))
            bot.chat('Arrived.')
        } catch (error) {
            if (isInterrupted(error)) return
            if (isNoPath(error)) {
                bot.chat('No path to that position.')
                return
            }
            throw error
        }
    }
}
