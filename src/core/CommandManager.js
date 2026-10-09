export default class CommandManager {
    constructor(bot, config, registry) {
        this.bot = bot
        this.config = config
        this.registry = registry
    }

    load() {
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return
            return this.handle(username, message)
        })
    }

    async handle(username, message) {
        const prefix = this.config.bot.prefix
        if (!message.startsWith(prefix)) return
        const args = message.slice(prefix.length) .trim() .split(/\s+/)
        const commandName = args.shift()?.toLowerCase()
        if (!commandName) return
        const command = this.registry.get(commandName)
        if (!command) return
        try {
            await command.execute({ bot: this.bot, username, args })
        } catch (error) {
            console.error(`[COMMAND ERROR] ${commandName}`, error)
            this.bot.chat('Command execution error.')
        }
    }
}
