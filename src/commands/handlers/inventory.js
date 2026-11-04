export default {
    name: 'inventory',

    async execute({ contract, reply }) {
        const { items } = contract.inventory()

        if (!items.length) {
            reply('Inventory is empty.')
            return
        }

        const text = items.map(item => `${item.name} x${item.count}`).join(', ')
        reply(text.slice(0, 240))
    }
}
