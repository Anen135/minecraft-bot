export default {
    name: 'chop',

    async execute({ contract, reply }) {
        const result = await contract.chopTree({
            onStart: count => reply(`Chopping tree: ${count} blocks.`)
        })
        if (result.status === 'interrupted') return
        if (result.status === 'error') {
            reply(result.code === 'no_log' ? result.message : `Could not chop tree: ${result.name}: ${result.message}`)
            return
        }
        reply(result.completed === result.total ? 'Tree chopped successfully.' : `Chopped ${result.completed}/${result.total} blocks.`)
    }
}
