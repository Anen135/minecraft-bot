export default {
    name: 'environment',
    execute({ contract }) {
        return contract.environment()
    }
}
