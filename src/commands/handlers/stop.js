export default {
    name: 'stop',

    async execute({ contract, reply }) {
        await contract.stop()
        reply('Stopped.')
    }
}
