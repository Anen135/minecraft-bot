import config from './config.js'
import BotManager from './core/BotManager.js'
import CommandLoader from './core/CommandLoader.js'
import CommandRegistry from './core/CommandRegistry.js'
import CommandManager from './core/CommandManager.js'
import ConsoleInput from './core/ConsoleInput.js'

const registry = new CommandRegistry(await new CommandLoader(new URL('./commands/', import.meta.url)).load())

// onReady runs after every (re)connect: each reconnect creates a new bot, so commands must be attached again
const manager = new BotManager(config, {
    onReady(bot, perception) {
        manager.commandManager = new CommandManager(bot, config, registry, { perception })
        manager.commandManager.load()
    }
})

manager.start()
const shutdown = () => {
    consoleInput.stop()
    manager.stop()
}
const consoleInput = new ConsoleInput(() => manager.commandManager,
    { username: config.bot.owner, onInterrupt: shutdown })
consoleInput.start()

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, shutdown)
}
