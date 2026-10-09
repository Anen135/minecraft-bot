import { readdirSync } from 'fs'

export default class CommandManager {
    constructor(bot, config) {
        this.bot = bot
        this.config = config
        this.commands = new Map()
    }

    async load() {
        const commandsUrl = new URL('../commands/', import.meta.url)
        const files = readdirSync(commandsUrl).filter(file => file.endsWith('.js'))

        for (const file of files) {
            try {
                const { default: command } = await import(new URL(file, commandsUrl))

                if (!command?.name || typeof command.execute !== 'function') {
                    console.warn(`[COMMAND] Invalid command file: ${file}`)
                    continue
                }

                this.commands.set(command.name, command)

                console.log(`[COMMAND] Loaded: ${command.name}`)
            } catch (error) {
                console.error(`[COMMAND] Failed to load ${file}`, error)
            }
        }

        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return

            this.handle(username, message)
        })
    }

    async handle(username, message) {
        const prefix = this.config.bot.prefix

        if (!message.startsWith(prefix)) return

        const args = message
            .slice(prefix.length)
            .trim()
            .split(/\s+/)

        const commandName = args.shift()?.toLowerCase()

        const command = this.commands.get(commandName)

        if (!command) return

        try {
            await command.execute({
                bot: this.bot,
                username,
                args
            })
        } catch (error) {
            console.error(`[COMMAND ERROR] ${commandName}`, error)

            this.bot.chat('Command execution error.')
        }
    }
}