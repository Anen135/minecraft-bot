import { EventEmitter } from 'node:events'

export const OBSERVATION_PRIORITIES = ['debug', 'info', 'warning', 'danger']

export default class ObservationBus {
    constructor() {
        this.events = new EventEmitter()
    }

    on(observer) {
        if (typeof observer !== 'function') throw new TypeError('Observer must be a function.')
        this.events.on('observation', observer)
        return () => this.events.off('observation', observer)
    }

    emit(observation) {
        if (!observation || typeof observation.type !== 'string' || !observation.type.trim() ||
            !OBSERVATION_PRIORITIES.includes(observation.priority) ||
            !observation.data || typeof observation.data !== 'object' || Array.isArray(observation.data)) {
            throw new TypeError('Observation requires a type, priority and structured data.')
        }
        this.events.emit('observation', observation)
        return observation
    }
}
