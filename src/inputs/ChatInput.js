export default class ChatInput {
    constructor(bot) {
        this.bot = bot
        this.chatListener = null
    }

    start(callback) {
        if (this.chatListener) return
        if (typeof callback !== 'function') throw new TypeError('ChatInput requires a callback.')
        this.chatListener = (username, message) => {
            if (username === this.bot.username) return
            try {
                Promise.resolve(callback(username, message)).catch(error => {
                    console.error('[ChatInput] Callback failed:', error)
                })
            } catch (error) {
                console.error('[ChatInput] Callback failed:', error)
            }
        }
        this.bot.on('chat', this.chatListener)
    }

    stop() {
        if (!this.chatListener) return
        this.bot.off('chat', this.chatListener)
        this.chatListener = null
    }
}
