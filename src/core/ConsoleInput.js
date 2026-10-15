import { createInterface } from 'node:readline'

export default class ConsoleInput {
    constructor(getCommandManager, { input = process.stdin, output = process.stdout, username, onInterrupt } = {}) {
        this.getCommandManager = getCommandManager
        this.input = input
        this.output = output
        this.username = username
        this.readline = null
        this.lineListener = null
        this.onInterrupt = onInterrupt || (() => this.stop())
    }

    start() {
        if (this.readline) return
        this.readline = createInterface({ input: this.input, output: this.output,
            terminal: Boolean(this.input.isTTY && this.output.isTTY) })
        this.lineListener = line => { void this.handle(line) }
        this.readline.on('line', this.lineListener)
        this.readline.on('SIGINT', this.onInterrupt)
    }

    async handle(line) {
        const message = line.trim()
        if (!message) return
        const manager = this.getCommandManager()
        if (!manager) {
            this.output.write('[CONSOLE] Bot is not ready.\n')
            return
        }
        await manager.handle(this.username || manager.bot.username, message,
            { reply: text => this.output.write(`${text}\n`) })
    }

    stop() {
        if (!this.readline) return
        this.readline.off('line', this.lineListener)
        this.readline.off('SIGINT', this.onInterrupt)
        this.readline.close()
        this.readline = null
        this.lineListener = null
    }
}
