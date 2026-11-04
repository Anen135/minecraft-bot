const EQUIP_DESTINATIONS = ['hand', 'off-hand', 'head', 'torso', 'legs', 'feet']

export default {
    name: 'equip',

    async execute({ contract, args = [], reply }) {
        const destination = args.length === 2 ? args[1] : 'hand'
        if (args.length < 1 || args.length > 2 || !args[0].trim() || !EQUIP_DESTINATIONS.includes(destination)) {
            reply('Usage: !equip <item> [hand|off-hand|head|torso|legs|feet]')
            return
        }
        const result = await contract.equip(args[0], destination)
        reply(result.status === 'success' ? `Equipped ${args[0]} in ${destination}.` : `Could not equip: ${result.message}`)
    }
}
