import InventoryService from '../services/InventoryService.js'

export default {
    name: 'inventory',

    async execute({ bot }) {
        const { items } = InventoryService.list(bot)

        if (!items.length) {
            bot.chat('Inventory is empty.')
            return
        }

        const text = items.map(item => `${item.name} x${item.count}`).join(', ')
        bot.chat(text.slice(0, 240))
    }
}
