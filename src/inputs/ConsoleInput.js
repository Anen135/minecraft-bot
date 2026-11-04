import { createInterface } from 'node:readline'

export default class ConsoleInput {
    constructor({ input = process.stdin, output = process.stdout, onInterrupt } = {}) {
        this.input = input
        this.output = output
        this.readline = null
        this.lineListener = null
        this.interruptListener = null
        this.closeListener = null
        this.onInterrupt = onInterrupt || (() => this.stop())
    }

    start(callback) {
        if (this.readline) return
        if (typeof callback !== 'function') throw new TypeError('ConsoleInput requires a callback.')
        this.input.ref?.()
        this.readline = createInterface({ input: this.input, output: this.output, terminal: Boolean(this.input.isTTY && this.output.isTTY) })
        this.lineListener = line => {
            try {
                Promise.resolve(callback(line)).catch(error => {
                    console.error('[ConsoleInput] Callback failed:', error)
                })
            } catch (error) {
                console.error('[ConsoleInput] Callback failed:', error)
            }
        }
        this.interruptListener = () => {
            try {
                Promise.resolve(this.onInterrupt()).catch(error => {
                    console.error('[ConsoleInput] Interrupt callback failed:', error)
                })
            } catch (error) {
                console.error('[ConsoleInput] Interrupt callback failed:', error)
            }
        }
        this.closeListener = () => this.stop()
        this.readline.on('line', this.lineListener)
        this.readline.on('SIGINT', this.interruptListener)
        this.readline.on('close', this.closeListener)
    }

    stop() {
        if (!this.readline) return
        this.readline.off('line', this.lineListener)
        this.readline.off('SIGINT', this.interruptListener)
        this.readline.off('close', this.closeListener)
        this.readline.close()
        // A paused stdin pipe can still keep Node.js alive after readline closes.
        this.input.unref?.()
        this.readline = null
        this.lineListener = null
        this.interruptListener = null
        this.closeListener = null
    }
}
