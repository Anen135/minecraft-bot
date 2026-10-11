import { createBot } from 'mineflayer'
import pathfinderPlugin from 'mineflayer-pathfinder'
import minecraftData from 'minecraft-data'
import { plugin as collectBlock } from 'mineflayer-collectblock'

const { pathfinder, Movements } = pathfinderPlugin
export default class BotManager {
    constructor(config) {
        this.config = config
        this.bot = null
        this.commandManager = null
    }

    start() {
        this.bot = createBot(this.config.minecraft)
        this.bot.loadPlugin(pathfinder)
        this.bot.loadPlugin(collectBlock)
        this.registerEvents()
    }

    registerEvents() {
        this.bot.once('spawn', () => {
            const mcData = minecraftData(this.bot.version)
            const movements = new Movements(this.bot, mcData)
            this.bot.pathfinder.setMovements(movements)
            console.log(`[BOT] ${this.bot.username} connected. Version: ${this.bot.version}`)
        })

        this.bot.on('death', () => { console.log('[BOT] Bot died.') })
        this.bot.on('kicked', reason => { console.log('[BOT] Kicked:', reason) })
        this.bot.on('error', error => { console.error('[BOT ERROR]', error) })
        this.bot.on('end', reason => { console.log('[BOT] Connection closed:', reason) })
    }
}
