function _a(contract, username, args) {
    if (args.length != 0) return null
    const coords = contract.playerPosition(username)
    if (!coords) return null
    return [ coords.x, coords.y, coords.z ]
}

function _b(contract, args) {
    if (args.length != 1) return null
    const coords = contract.playerPosition(args[0])
    if (!coords) return null
    return [ coords.x, coords.y, coords.z ]
}
function _c(args) {
    if (args.length != 3) return null
    if (args.some(coord => typeof coord !== 'string' || coord.trim() === '')) return null
    const [x, y, z] = args.slice(0, 3).map(Number)
    if (![x, y, z].every(Number.isFinite)) return null
    return [ x, y, z ]
}

function router(contract, username, args) {
    return _a(contract, username, args) || _b(contract, args) || _c(args)
}

export default {
    name: 'goto',

    async execute({ contract, username, args, reply }) {
        const coordinates = router(contract, username, args)
        if (!coordinates) {
            reply('Usage: !goto x y z')
            return
        }
        const [x, y, z] = coordinates.map(Number)

        reply(`Going to ${x} ${y} ${z}`)

        const result = await contract.goto(x, y, z)
        if (result.status === 'arrived') reply('Arrived.')
        if (result.status === 'no_path') reply('No path to that position.')
    }
}
