import pathfinder from 'mineflayer-pathfinder'
import { interruptedErrors } from '../utils/pathErrors.js'

const { GoalBlock, GoalFollow } = pathfinder.goals

export default class NavigationService {
    static async goto(bot, x, y, z) {
        if (![x, y, z].every(Number.isFinite)) {
            throw new TypeError('Coordinates must be finite numbers.')
        }

        try {
            await bot.pathfinder.goto(new GoalBlock(x, y, z))
            return { status: 'arrived' }
        } catch (error) {
            if (interruptedErrors.includes(error?.name)) return { status: 'interrupted' }
            if (error?.name === 'NoPath') return { status: 'no_path' }
            throw error
        }
    }

    static follow(bot, username) {
        const entity = bot.players?.[username]?.entity
        if (!entity) return { status: 'player_not_found' }

        bot.pathfinder.setGoal(new GoalFollow(entity, 2), true)
        return { status: 'following' }
    }

    static async stop(bot) {
        // Clearing targets also stops collectBlock's loop between individual blocks.
        // cancelTask may wait forever for entityGone while collecting an item drop.
        bot.collectBlock?.targets?.clear()
        bot.pathfinder.stop()
        bot.pathfinder.setGoal?.(null)
        if (bot.targetDigBlock) bot.stopDigging?.()
        bot.clearControlStates()
        return { status: 'stopped' }
    }
}
