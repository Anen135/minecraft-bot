export default {
    name: 'look',
    execute({ perception }) {
        if (!perception) throw new Error('Perception is not ready.')
        perception.look()
    }
}
