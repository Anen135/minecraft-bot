class WanderBehavior {
    constructor(bot) { this.bot = bot }

    async start() {
        console.log( '[BEHAVIOR] Wander started' )
    }

    async stop() {
        this.bot.pathfinder.stop()
    }
}

export default WanderBehavior
