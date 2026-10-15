export default {
    name: 'environment',
    execute({ perception }) {
        if (!perception) throw new Error('Perception is not ready.')
        perception.environment()
    }
}
