const config = require('./config')
const BotManager = require('./core/BotManager')
const CommandManager = require('./core/CommandManager')

const manager = new BotManager(config)

manager.start()

manager.bot.once('spawn', () => {
    manager.commandManager = new CommandManager( manager.bot, config)

    manager.commandManager.load()
})
