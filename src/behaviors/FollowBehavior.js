export default class FollowBehavior {
    constructor(bot) { this.bot = bot }

    async start({ player }) {
        console.log(`[BEHAVIOR] Following ${player}`)
    }

    async stop() {
        this.bot.pathfinder.stop()
    }
}
