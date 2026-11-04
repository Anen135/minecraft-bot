import { createBot as defaultCreateBot } from 'mineflayer'
import pathfinderPlugin from 'mineflayer-pathfinder'
import minecraftData from 'minecraft-data'
import { plugin as collectBlock } from 'mineflayer-collectblock'
import InputManager from '../inputs/InputManager.js'
import CommandManager from '../commands/CommandManager.js'
import PerceptionManager from '../perception/PerceptionManager.js'
import StateManager from '../states/StateManager.js'
import PluginManager from '../plugins/PluginManager.js'
import ServiceManager from '../services/ServiceManager.js'
import { createInputContract } from './contracts/InputContract.js'
import { createCommandContract } from './contracts/CommandContract.js'
import { createPerceptionContract } from './contracts/PerceptionContract.js'
import { createStateContract } from './contracts/StateContract.js'
import { createPluginContract } from './contracts/PluginContract.js'
import { createServiceContract } from './contracts/ServiceContract.js'

const { pathfinder, Movements } = pathfinderPlugin
const DEFAULT_RECONNECT = { min: 5_000, max: 60_000 }

export default class BotManager {
    constructor(config, { onReady, onObservation, createBot = defaultCreateBot, reconnect = {},
        createPerception = (bot, options) => new PerceptionManager(bot, options),
        createReporter, inputOptions = {}, commandOptions = {} } = {}) {
        this.config = config
        this.onReady = onReady
        this.onObservation = onObservation
        this.createBot = createBot
        this.createPerception = createPerception
        this.createReporter = createReporter
        this.commandOptions = commandOptions
        this.reconnect = { ...DEFAULT_RECONNECT, ...reconnect }
        this.reconnectDelay = this.reconnect.min
        this.reconnectTimer = null
        this.stopped = false
        this.ready = false
        this.bot = null
        this.inputs = new InputManager(createInputContract(this), { username: config.bot?.owner, ...inputOptions })
        this.commands = null
        this.perception = null
        this.states = null
        this.plugins = null
        this.services = null
        this.sessionCleanup = null
        this.readyCleanup = null
        this.sessionReady = null
        this.disposal = Promise.resolve()
    }

    start() {
        if (this.bot) return
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this.stopped = false
        try {
            this.inputs.start()
            const bot = this.createBot(this.config.minecraft)
            this.bot = bot
            this.registerEvents(bot)
            bot.loadPlugin(pathfinder)
            bot.loadPlugin(collectBlock)
        } catch (error) {
            this.sessionReady = this.failSession(this.bot, error)
        }
    }

    stop() {
        this.stopped = true
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        try {
            this.inputs.stop()
        } catch (error) {
            console.error('[BOT] Input shutdown failed:', error)
        }
        const bot = this.bot
        const disposal = this.disposeSession(bot)
        try {
            bot?.quit?.()
        } catch (error) {
            console.error('[BOT] Disconnect failed:', error)
        }
        return disposal
    }

    registerEvents(bot) {
        const onSpawn = () => {
            if (this.stopped || bot !== this.bot) return
            this.sessionReady = this.initializeSession(bot)
        }
        const onKicked = reason => { console.log('[BOT] Kicked:', reason) }
        const onError = error => { console.error('[BOT ERROR]', error) }
        const onEnd = reason => {
            if (bot !== this.bot) return
            console.log('[BOT] Connection closed:', reason)
            void this.disposeSession(bot).then(() => this.scheduleReconnect())
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

    async initializeSession(bot) {
        try {
            const movements = new Movements(bot, minecraftData(bot.version))
            bot.pathfinder.setMovements(movements)
            this.services = new ServiceManager(bot, createServiceContract())
            this.perception = this.createPerception(bot, {
                contract: createPerceptionContract(this), createReporter: this.createReporter
            })
            this.states = new StateManager(createStateContract())
            this.plugins = new PluginManager(createPluginContract())
            const commands = new CommandManager(this.config, createCommandContract(this), this.commandOptions)
            this.commands = commands
            await commands.initialize()
            if (this.stopped || bot !== this.bot) return
            this.perception.start()
            this.ready = true
            this.inputs.startSession(bot)
            const cleanup = await this.onReady?.(bot, this.perception)
            if (typeof cleanup === 'function') {
                if (bot === this.bot) this.readyCleanup = cleanup
                else await cleanup()
            }
            if (bot !== this.bot || this.stopped) return
            this.reconnectDelay = this.reconnect.min
            console.log(`[BOT] ${bot.username} connected. Version: ${bot.version}`)
        } catch (error) {
            await this.failSession(bot, error)
        }
    }

    async failSession(bot, error) {
        console.error('[BOT] Initialization failed:', error)
        if (bot && bot !== this.bot) return
        await this.disposeSession(bot)
        try {
            bot?.quit?.()
        } catch (quitError) {
            console.error('[BOT] Disconnect failed:', quitError)
        }
        this.scheduleReconnect()
    }

    disposeSession(bot) {
        if (!bot || bot !== this.bot) return this.disposal
        const { readyCleanup, sessionCleanup, services, perception, states, plugins } = this
        this.ready = false
        this.bot = null
        this.commands = null
        this.perception = null
        this.states = null
        this.plugins = null
        this.services = null
        this.readyCleanup = null
        this.sessionCleanup = null
        const pending = []
        const release = callback => {
            try {
                pending.push(Promise.resolve(callback()).catch(error => {
                    console.error('[BOT] Session cleanup failed:', error)
                }))
            } catch (error) {
                console.error('[BOT] Session cleanup failed:', error)
            }
        }
        release(() => this.inputs.stopSession())
        release(() => sessionCleanup?.())
        release(() => readyCleanup?.())
        release(() => states?.stop())
        release(() => services?.dispose())
        release(() => plugins?.dispose())
        release(() => perception?.stop())
        this.disposal = Promise.all(pending).then(() => {})
        return this.disposal
    }

    handleInput({ source, username, message, reply }) {
        if (!this.ready) {
            if (source === 'console') reply?.('[CONSOLE] Bot is not ready.')
            return
        }
        return this.commands.handle(username, message, { reply })
    }

    replyChat(bot, message) {
        if (this.ready && bot === this.bot) bot.chat(message)
    }

    scheduleReconnect() {
        if (this.stopped || this.reconnectTimer || this.bot) return
        const delay = this.reconnectDelay
        this.reconnectDelay = Math.min(delay * 2, this.reconnect.max)
        console.log(`[BOT] Reconnecting in ${Math.round(delay / 1000)}s...`)
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.start()
        }, delay)
    }
}
