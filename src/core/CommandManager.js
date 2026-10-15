export default class CommandManager {
    constructor(bot, config, registry, { perception } = {}) {
        this.bot = bot
        this.config = config
        this.registry = registry
        this.perception = perception
        this.chatListener = null
    }

    load() {
        if (this.chatListener) return
        this.chatListener = (username, message) => {
            if (username === this.bot.username) return
            return this.handle(username, message)
        }
        this.bot.on('chat', this.chatListener)
    }

    unload() {
        if (this.chatListener) this.bot.off('chat', this.chatListener)
        this.chatListener = null
    }

    async handle(username, message, { reply } = {}) {
        const {prefix} = this.config.bot
        if (!message.startsWith(prefix)) return
        const args = message.slice(prefix.length) .trim() .split(/\s+/)
        const commandName = args.shift()?.toLowerCase()
        if (!commandName) return
        const command = this.registry.get(commandName)
        if (!command) return
        try {
            const context = { bot: this.bot, username, args }
            if (this.perception) context.perception = this.perception
            if (reply) context.reply = reply
            await command.execute(context)
        } catch (error) {
            console.error(`[COMMAND ERROR] ${commandName}`, error)
            if (reply) reply('Command execution error.')
            else this.bot.chat('Command execution error.')
        }
    }
}
