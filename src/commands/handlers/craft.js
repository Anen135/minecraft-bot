export default {
    name: 'craft',

    async execute({ contract, args = [], reply }) {
        const count = args.length === 2 ? Number(args[1]) : 1
        if (args.length < 1 || args.length > 2 || !args[0].trim() ||
            (args.length === 2 && !args[1].trim()) || !Number.isSafeInteger(count) || count < 1) {
            reply('Usage: !craft <item> [count]')
            return
        }
        const result = await contract.craft(args[0], count)
        reply(result.status === 'success'
            ? `Crafted ${result.count} ${args[0]}.`
            : `Could not craft: ${result.message}`)
    }
}
