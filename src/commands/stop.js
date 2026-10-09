export default {
    name: 'stop',
    async execute({ bot }) {
        bot.pathfinder.stop()
        bot.clearControlStates()
        bot.chat('Stopped.')
    }
}
