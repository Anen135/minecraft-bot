export default class CommandRegistry {
    constructor(commands = []) {
        this.commands = new Map()

        for (const command of commands) {
            this.register(command)
        }
    }

    register(command) {
        if (typeof command?.name !== 'string' || !command.name.trim() ||
            typeof command.execute !== 'function') {
            throw new Error('Command must have a nonempty name and an execute function.')
        }
        const name = command.name.toLowerCase()
        if (this.commands.has(name)) {
            throw new Error(`Command "${name}" is already registered.`)
        }
        this.commands.set(name, command)
    }

    unregister(name) { return this.commands.delete(name.toLowerCase()) }
    get(name) { return this.commands.get(name.toLowerCase()) }
    has(name) { return this.commands.has(name.toLowerCase()) }
    all() { return [...this.commands.values()] }
    names() { return [...this.commands.keys()] }
    get size() { return this.commands.size }
}
