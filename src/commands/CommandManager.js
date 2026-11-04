import CommandLoader from './CommandLoader.js'
import CommandRegistry from './CommandRegistry.js'

export default class CommandManager {
    constructor(config, contract, { registry = new CommandRegistry(),
        loader = new CommandLoader(new URL('./handlers/', import.meta.url)) } = {}) {
        this.config = config
        this.contract = contract
        this.registry = registry
        this.loader = loader
        this.initialization = null
    }

    initialize() {
        if (!this.initialization) {
            this.initialization = this.loader.load().then(commands => {
                for (const command of commands) this.registry.register(command)
            })
        }
        return this.initialization
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
            await command.execute({ username, args, reply: reply || this.contract.reply, contract: this.contract })
        } catch (error) {
            console.error(`[COMMAND ERROR] ${commandName}`, error)
            if (reply) reply('Command execution error.')
            else this.contract.reply('Command execution error.')
        }
    }
}
