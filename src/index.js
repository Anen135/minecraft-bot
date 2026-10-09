import config from './config.js'
import BotManager from './core/BotManager.js'
import CommandLoader from './core/CommandLoader.js'
import CommandRegistry from './core/CommandRegistry.js'
import CommandManager from './core/CommandManager.js'

const registry = new CommandRegistry(await new CommandLoader(new URL('./commands/', import.meta.url)).load())
const manager = new BotManager(config)
manager.start()
manager.bot.once('spawn', () => {
    manager.commandManager = new CommandManager(manager.bot, config, registry)
    manager.commandManager.load()
})
