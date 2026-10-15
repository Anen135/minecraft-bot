export default {
    name: 'help',

    async execute({ bot, reply = message => bot.chat(message) }) {
        reply( 'Commands: !help !follow !stop !goto !inventory' )
        reply( '!chop !mine <block> [count] !equip <item> [destination] !craft <item> [count]' )
        reply( '!status !look !nearby !environment !scan' )
    }
}
