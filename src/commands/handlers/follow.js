export default {
    name: 'follow',

    async execute({ contract, username, args, reply }) {
        const targetName = args[0] || username
        const result = contract.follow(targetName)
        if (result.status === 'player_not_found') {
            reply(`I cannot see ${targetName}.`)
            return
        }
        reply(`Following ${targetName}.`)
    }
}
