import { createBot as defaultCreateBot } from 'mineflayer'
import pathfinderPlugin from 'mineflayer-pathfinder'
import minecraftData from 'minecraft-data'
import { plugin as collectBlock } from 'mineflayer-collectblock'

const { pathfinder, Movements } = pathfinderPlugin

const DEFAULT_RECONNECT = { min: 5_000, max: 60_000 }

export default class BotManager {
    constructor(config, { onReady, createBot = defaultCreateBot, reconnect = {} } = {}) {
        this.config = config
        this.onReady = onReady
        this.createBot = createBot
        this.reconnect = { ...DEFAULT_RECONNECT, ...reconnect }
        this.reconnectDelay = this.reconnect.min
        this.reconnectTimer = null
        this.stopped = false
        this.bot = null
        this.commandManager = null
    }

    start() {
        this.stopped = false
        const bot = this.createBot(this.config.minecraft)
        this.bot = bot
        bot.loadPlugin(pathfinder)
        bot.loadPlugin(collectBlock)
        this.registerEvents(bot)
    }

    stop() {
        this.stopped = true
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this.bot?.quit?.()
    }

    registerEvents(bot) {
        bot.once('spawn', () => {
            const mcData = minecraftData(bot.version)
            const movements = new Movements(bot, mcData)
            bot.pathfinder.setMovements(movements)
            this.reconnectDelay = this.reconnect.min
            console.log(`[BOT] ${bot.username} connected. Version: ${bot.version}`)
            this.onReady?.(bot)
        })

        bot.on('death', () => { console.log('[BOT] Bot died.') })
        bot.on('kicked', reason => { console.log('[BOT] Kicked:', reason) })
        bot.on('error', error => { console.error('[BOT ERROR]', error) })
        bot.once('end', reason => {
            console.log('[BOT] Connection closed:', reason)
            this.scheduleReconnect()
        })
    }

    scheduleReconnect() {
        if (this.stopped || this.reconnectTimer) return

        const delay = this.reconnectDelay
        this.reconnectDelay = Math.min(delay * 2, this.reconnect.max)
        console.log(`[BOT] Reconnecting in ${Math.round(delay / 1000)}s...`)

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.start()
        }, delay)
    }
}