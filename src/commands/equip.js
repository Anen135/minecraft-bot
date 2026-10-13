import InventoryService, { EQUIP_DESTINATIONS } from '../services/InventoryService.js'

export default {
    name: 'equip',

    async execute({ bot, args = [] }) {
        const destination = args.length === 2 ? args[1] : 'hand'
        if (args.length < 1 || args.length > 2 || !args[0].trim() || !EQUIP_DESTINATIONS.includes(destination)) {
            bot.chat('Usage: !equip <item> [hand|off-hand|head|torso|legs|feet]')
            return
        }
        const result = await InventoryService.equip(bot, args[0], destination)
        bot.chat(result.status === 'success' ? `Equipped ${args[0]} in ${destination}.` : `Could not equip: ${result.message}`)
    }
}
