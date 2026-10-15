export default {
    name: 'status',
    execute({ perception }) {
        if (!perception) throw new Error('Perception is not ready.')
        perception.status()
    }
}
