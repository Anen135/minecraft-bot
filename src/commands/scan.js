export default {
    name: 'scan',
    execute({ perception }) {
        if (!perception) throw new Error('Perception is not ready.')
        perception.scan()
    }
}
