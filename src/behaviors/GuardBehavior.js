class GuardBehavior {
    constructor(bot) { this.bot = bot }

    async start(options = {}) {
        console.log( '[BEHAVIOR] Guard started', options )
    }

    async stop() {
        console.log( '[BEHAVIOR] Guard stopped' )
    }
}

export default GuardBehavior
