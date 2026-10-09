const { goals } = require('mineflayer-pathfinder')
const { GoalFollow } = goals

export default {
    name: 'follow',

    async execute({ bot, username, args }) {
        const targetName = args[0] || username
        const player = bot.players[targetName]

        if (!player?.entity) {
            bot.chat(`I cannot see ${targetName}.`)
            return
        }
        bot.pathfinder.setGoal(new GoalFollow(player.entity, 2), true)
        bot.chat(`Following ${targetName}.`)
    }
}
