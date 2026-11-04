export default {
    name: 'help',

    async execute({ reply }) {
        reply( 'Commands: !help !follow !stop !goto !inventory' )
        reply( '!chop !mine <block> [count] !equip <item> [destination] !craft <item> [count]' )
        reply( '!status !look !nearby !environment !scan' )
    }
}
