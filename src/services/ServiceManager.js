import NavigationService from './NavigationService.js'
import MiningService from './MiningService.js'
import CraftingService from './CraftingService.js'
import InventoryService from './InventoryService.js'
import MemoryService from './MemoryService.js'

export default class ServiceManager {
    constructor(bot, contract) {
        this.bot = bot
        this.contract = contract
        this.memory = new MemoryService()
    }

    requireBot() {
        if (!this.bot) throw new Error('Bot is not ready.')
        return this.bot
    }

    goto(x, y, z) { return NavigationService.goto(this.requireBot(), x, y, z) }
    follow(username) { return NavigationService.follow(this.requireBot(), username) }
    stop() { return NavigationService.stop(this.requireBot()) }
    mine(block, count) { return MiningService.mine(this.requireBot(), block, count) }
    chopTree(options) { return MiningService.chopTree(this.requireBot(), options) }
    craft(item, count) { return CraftingService.craft(this.requireBot(), item, count) }
    inventory() { return InventoryService.list(this.requireBot()) }
    equip(item, destination) { return InventoryService.equip(this.requireBot(), item, destination) }

    playerPosition(username) {
        const position = this.requireBot().players?.[username]?.entity?.position
        return position ? { x: position.x, y: position.y, z: position.z } : null
    }

    dispose() {
        const bot = this.bot
        this.bot = null
        if (bot?.pathfinder?.stop) return NavigationService.stop(bot)
    }
}
