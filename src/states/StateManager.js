export default class StateManager {
    constructor(contract) {
        this.contract = contract
        this.current = null
    }

    async start(behavior, options = {}) {
        if (this.current?.stop) {
            await this.current.stop()
        }

        this.current = behavior

        if (this.current?.start) {
            await this.current.start(options)
        }
    }

    async stop() {
        if (this.current?.stop) {
            await this.current.stop()
        }

        this.current = null
    }
}
