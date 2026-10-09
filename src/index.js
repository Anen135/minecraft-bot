import config from './config.js'
import BotManager from './core/BotManager.js'
import CommandLoader from './core/CommandLoader.js'
import CommandRegistry from './core/CommandRegistry.js'
import CommandManager from './core/CommandManager.js'

const commandsUrl = new URL('./commands/', import.meta.url)
const loader = new CommandLoader(commandsUrl)
const commands = await loader.load()
const registry = new CommandRegistry(commands)

const manager = new BotManager(config)

manager.start()

manager.bot.once('spawn', () => {
    manager.commandManager = new CommandManager(manager.bot, config, registry)
    manager.commandManager.load()
})
