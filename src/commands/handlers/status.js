export default {
    name: 'status',
    execute({ contract }) {
        return contract.status()
    }
}
