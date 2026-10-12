import InventoryService from '../services/InventoryService.js'

// Интерфейс: !inventory показывает содержимое инвентаря — логика в InventoryService.

export default {
    name: 'inventory',

    async execute({ bot }) {
        bot.chat(new InventoryService(bot).describe())
    }
}
