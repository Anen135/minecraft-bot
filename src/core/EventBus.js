import { EventEmitter } from 'node:events'
class EventBus extends EventEmitter {}
export default new EventBus()