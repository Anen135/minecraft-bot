import { readdirSync } from 'node:fs'

export default class CommandLoader {
    constructor(commandsUrl) {
        this.commandsUrl = commandsUrl
    }

    async load() {
        const files = readdirSync(this.commandsUrl, { withFileTypes: true }) .filter(file => file.isFile() && file.name.endsWith('.js'))
        const commands = []

        for (const file of files) {
            try {
                const { default: command } = await import( new URL(encodeURIComponent(file.name), this.commandsUrl) )

                if (typeof command?.name !== 'string' || !command.name.trim() ||
                    typeof command.execute !== 'function') {
                    console.warn(`[COMMAND] Invalid command file: ${file.name}`)
                    continue
                }

                commands.push(command)
                console.log(`[COMMAND] Loaded: ${command.name}`)
            } catch (error) {
                console.error(`[COMMAND] Failed to load ${file.name}`, error)
            }
        }

        return commands
    }
}
