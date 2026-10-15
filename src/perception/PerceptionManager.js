import ObservationBus from './ObservationBus.js'
import StatusDetector from './detectors/StatusDetector.js'
import EntityDetector from './detectors/EntityDetector.js'
import LookDetector from './detectors/LookDetector.js'
import EnvironmentDetector from './detectors/EnvironmentDetector.js'
import EventDetector from './detectors/EventDetector.js'

export default class PerceptionManager {
    constructor(bot, { bus = new ObservationBus() } = {}) {
        this.bot = bot
        this.bus = bus
        this.statusDetector = new StatusDetector(bot, bus)
        this.entityDetector = new EntityDetector(bot, bus)
        this.lookDetector = new LookDetector(bot, bus)
        this.environmentDetector = new EnvironmentDetector(bot, bus)
        this.eventDetector = new EventDetector(bot, bus)
        this.detectors = [this.statusDetector, this.entityDetector, this.lookDetector,
            this.environmentDetector, this.eventDetector]
        this.running = false
    }

    start() {
        if (this.running) return
        this.running = true
        try {
            for (const detector of this.detectors) detector.start()
        } catch (error) {
            this.stop()
            throw error
        }
    }

    stop() {
        for (const detector of this.detectors) detector.stop()
        this.running = false
    }

    status() {
        if (!this.running) throw new Error('Perception is not ready.')
        return this.statusDetector.scan()
    }

    look() {
        if (!this.running) throw new Error('Perception is not ready.')
        return this.lookDetector.scan()
    }

    nearby() {
        if (!this.running) throw new Error('Perception is not ready.')
        return this.entityDetector.scan()
    }

    environment() {
        if (!this.running) throw new Error('Perception is not ready.')
        return this.environmentDetector.scan()
    }

    scan() {
        if (!this.running) throw new Error('Perception is not ready.')
        return this.bus.emit({ type: 'scan.snapshot', priority: 'info', data: {
            status: this.statusDetector.getSnapshot(),
            look: this.lookDetector.getSnapshot(),
            nearby: this.entityDetector.getSnapshot(),
            environment: this.environmentDetector.getSnapshot()
        } })
    }
}
