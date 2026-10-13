export default {
    name: 'help',

    async execute({ bot }) {
        bot.chat( 'Commands: !help !follow !stop !goto !inventory' )
        bot.chat( '!chop !mine <block> [count] !equip <item> [destination] !craft <item> [count]' )
    }
}
