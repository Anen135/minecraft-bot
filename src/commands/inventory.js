import InventoryService from '../services/InventoryService.js'

export default {
    name: 'inventory',

    async execute({ bot, reply = message => bot.chat(message) }) {
        const { items } = InventoryService.list(bot)

        if (!items.length) {
            reply('Inventory is empty.')
            return
        }

        const text = items.map(item => `${item.name} x${item.count}`).join(', ')
        reply(text.slice(0, 240))
    }
}
