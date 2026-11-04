export default {
    name: 'scan',
    execute({ contract }) {
        return contract.scan()
    }
}
