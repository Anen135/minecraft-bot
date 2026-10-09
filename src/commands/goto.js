const { goals } = require('mineflayer-pathfinder')
const { GoalBlock } = goals

export default {
    name: 'goto',

    async execute({ bot, args }) {
        const [x, y, z] = args.map(Number)
        if ([x, y, z].some(Number.isNaN)) {
            bot.chat( 'Usage: !goto x y z' )
            return
        }
        bot.chat(`Going to ${x} ${y} ${z}`)
        await bot.pathfinder.goto(new GoalBlock(x, y, z))
        bot.chat('Arrived.')
    }
}
