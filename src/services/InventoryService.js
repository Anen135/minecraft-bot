export const EQUIP_DESTINATIONS = ['hand', 'off-hand', 'head', 'torso', 'legs', 'feet']

export default class InventoryService {
    static list(bot) {
        return {
            status: 'success',
            items: bot.inventory.items().map(item => ({ name: item.name, count: item.count }))
        }
    }

    static async equip(bot, itemName, destination = 'hand') {
        if (!EQUIP_DESTINATIONS.includes(destination)) {
            return { status: 'error', code: 'invalid_destination', message: `Unknown equipment slot: ${destination}.` }
        }
        try {
            const itemType = bot.registry.itemsByName[itemName]
            if (!itemType) return { status: 'error', code: 'unknown_item', message: `Unknown item: ${itemName}.` }
            const item = bot.inventory.items().find(item => item.type === itemType.id)
            if (!item) return { status: 'error', code: 'missing_item', message: `No ${itemName} in inventory.` }
            await bot.equip(item, destination)
            return { status: 'success', itemName, destination }
        } catch (error) {
            return { status: 'error', code: 'equip_failed', message: error?.message || String(error) }
        }
    }
}
