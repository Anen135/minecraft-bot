// InventoryService — работа с инвентарём бота (Mineflayer-логика).

export default class InventoryService {
    constructor(bot) {
        this.bot = bot
    }

    // Все не пустые предметы в инвентаре.
    getItems() {
        return this.bot.inventory.items()
    }

    hasItems() {
        return this.getItems().length > 0
    }

    findItem(name) {
        return this.bot.inventory.findItemOrNull?.({ name }) ??
            this.getItems().find(item => item.name === name) ?? null
    }

    countItem(name) {
        return this.getItems()
            .filter(item => item.name === name)
            .reduce((total, item) => total + item.count, 0)
    }

    // Человекочитаемое описание инвентаря для ответа в чат.
    describe(maxLength = 240) {
        const items = this.getItems()
        if (!items.length) return 'Inventory is empty.'
        const text = items.map(item => `${item.name} x${item.count}`).join(', ')
        return text.slice(0, maxLength)
    }
}
