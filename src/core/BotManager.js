import { createBot as defaultCreateBot } from 'mineflayer'
import pathfinderPlugin from 'mineflayer-pathfinder'
import minecraftData from 'minecraft-data'
import { plugin as collectBlock } from 'mineflayer-collectblock'
import PerceptionManager from '../perception/PerceptionManager.js'
import ConsoleObservationReporter from '../perception/ConsoleObservationReporter.js'

const { pathfinder, Movements } = pathfinderPlugin

const DEFAULT_RECONNECT = { min: 5_000, max: 60_000 }

export default class BotManager {
    constructor(config, { onReady, createBot = defaultCreateBot, reconnect = {},
        createPerception = bot => new PerceptionManager(bot),
        createReporter = bus => new ConsoleObservationReporter(bus) } = {}) {
        this.config = config
        this.onReady = onReady
        this.createBot = createBot
        this.reconnect = { ...DEFAULT_RECONNECT, ...reconnect }
        this.reconnectDelay = this.reconnect.min
        this.reconnectTimer = null
        this.stopped = false
        this.bot = null
        this.commandManager = null
        this.perception = null
        this.reporter = null
        this.sessionCleanup = null
        this.readyCleanup = null
        this.createPerception = createPerception
        this.createReporter = createReporter
    }

    start() {
        if (this.bot) return
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
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
        const {bot} = this
        this.disposeSession(bot)
        bot?.quit?.()
    }

    registerEvents(bot) {
        const onSpawn = () => {
            if (this.stopped || bot !== this.bot) return
            const mcData = minecraftData(bot.version)
            const movements = new Movements(bot, mcData)
            bot.pathfinder.setMovements(movements)
            this.reconnectDelay = this.reconnect.min
            console.log(`[BOT] ${bot.username} connected. Version: ${bot.version}`)
            this.perception = this.createPerception(bot)
            this.reporter = this.createReporter(this.perception.bus)
            this.reporter.start()
            this.perception.start()
            const cleanup = this.onReady?.(bot, this.perception)
            if (typeof cleanup === 'function') {
                if (bot === this.bot) this.readyCleanup = cleanup
                else cleanup()
            }
        }

        const onKicked = reason => { console.log('[BOT] Kicked:', reason) }
        const onError = error => { console.error('[BOT ERROR]', error) }
        const onEnd = reason => {
            if (bot !== this.bot) return
            console.log('[BOT] Connection closed:', reason)
            this.disposeSession(bot)
            this.scheduleReconnect()
        }
        bot.once('spawn', onSpawn)
        bot.on('kicked', onKicked)
        bot.on('error', onError)
        bot.once('end', onEnd)
        this.sessionCleanup = () => {
            bot.off('spawn', onSpawn)
            bot.off('kicked', onKicked)
            bot.off('error', onError)
            bot.off('end', onEnd)
        }
    }

    disposeSession(bot) {
        if (!bot || bot !== this.bot) return
        const { readyCleanup, perception, reporter, sessionCleanup } = this
        this.readyCleanup = null
        this.perception = null
        this.reporter = null
        this.commandManager = null
        this.sessionCleanup = null
        this.bot = null
        // Detach session state before callbacks so cleanup cannot dispose it twice.
        try {
            readyCleanup?.()
        } catch (error) {
            console.error('[BOT] Session cleanup failed:', error)
        }
        perception?.stop()
        reporter?.stop()
        sessionCleanup?.()
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
