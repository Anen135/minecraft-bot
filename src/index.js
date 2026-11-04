import config from './config.js'
import BotManager from './core/BotManager.js'
import CommandLoader from './core/CommandLoader.js'
import CommandRegistry from './core/CommandRegistry.js'
import CommandManager from './core/CommandManager.js'
import ConsoleInput from './inputs/ConsoleInput.js'
import ChatInput from './inputs/ChatInput.js'

const registry = new CommandRegistry(await new CommandLoader(new URL('./commands/', import.meta.url)).load())

// Each connection owns its chat input; the console persists across reconnects.
const manager = new BotManager(config, {
    onReady(bot, perception) {
        const commands = new CommandManager(bot, config, registry, { perception })
        manager.commandManager = commands
        const chatInput = new ChatInput(bot)
        chatInput.start((username, message) => commands.handle(username, message))
        return () => chatInput.stop()
    }
})

manager.start()
const shutdown = () => { consoleInput.stop(); manager.stop() }
const consoleInput = new ConsoleInput({ onInterrupt: shutdown })
consoleInput.start(line => {
    const message = line.trim()
    if (!message) return
    const commands = manager.commandManager
    if (!commands) {
        console.log('[CONSOLE] Bot is not ready.')
        return
    }
    return commands.handle(config.bot.owner || commands.bot.username, message,
        { reply: message => console.log(message) })
})

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, shutdown)
}
