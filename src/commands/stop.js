export default {
    name: 'stop',

    async execute({ bot }) {
        // collectBlock keeps looping while it has targets, even if pathfinding is stopped
        bot.collectBlock?.targets?.clear()
        bot.pathfinder.stop()
        bot.clearControlStates()
        bot.chat('Stopped.')
    }
}
