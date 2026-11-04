import config from './config.js'
import BotManager from './core/BotManager.js'

const manager = new BotManager(config)
manager.start()

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
        void manager.stop().catch(error => console.error('[APP] Shutdown failed:', error))
    })
}
