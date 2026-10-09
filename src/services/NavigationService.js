class NavigationService {
    constructor(bot) {
        this.bot = bot
    }

    stop() {
        this.bot.pathfinder.stop()
        this.bot.clearControlStates()
    }
}

module.exports = NavigationService
