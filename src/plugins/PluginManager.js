export default class PluginManager {
    constructor(contract) {
        this.contract = contract
        this.plugins = new Map()
    }

    register(name, plugin) {
        this.plugins.set(name, plugin)
        console.log(`[PLUGIN] Registered: ${name}`)
    }

    get(name) {
        return this.plugins.get(name)
    }

    dispose() {
        this.plugins.clear()
    }
}
