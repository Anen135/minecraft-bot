export default {
    name: 'nearby',
    execute({ perception }) {
        if (!perception) throw new Error('Perception is not ready.')
        perception.nearby()
    }
}
