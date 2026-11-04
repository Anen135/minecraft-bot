import ChatInput from './ChatInput.js'
import ConsoleInput from './ConsoleInput.js'

export default class InputManager {
    constructor(contract, { username, consoleOptions = {}, write = console.log } = {}) {
        this.contract = contract
        this.username = username
        this.write = write
        this.console = new ConsoleInput({ ...consoleOptions, onInterrupt: () => contract.shutdown() })
        this.chat = null
        this.sessionUsername = null
    }

    start() {
        this.console.start(line => {
            const message = line.trim()
            if (!message) return
            return this.contract.handleInput({ source: 'console',
                username: this.username || this.sessionUsername, message, reply: this.write })
        })
    }

    startSession(bot) {
        this.stopSession()
        this.sessionUsername = bot.username
        this.chat = new ChatInput(bot)
        this.chat.start((username, message) => this.contract.handleInput({ source: 'chat', username, message }))
    }

    stopSession() {
        this.chat?.stop()
        this.chat = null
        this.sessionUsername = null
    }

    stop() {
        this.stopSession()
        this.console.stop()
    }
}
