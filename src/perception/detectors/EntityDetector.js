import { positionData, distanceBetween, directionBetween, relativeDirection } from '../spatial.js'

const HOSTILE = new Set(['zombie', 'husk', 'drowned', 'skeleton', 'stray', 'bogged', 'wither_skeleton',
    'creeper', 'spider', 'cave_spider', 'witch', 'pillager', 'vindicator', 'evoker', 'ravager',
    'slime', 'magma_cube', 'blaze', 'ghast', 'phantom', 'guardian', 'elder_guardian', 'warden', 'wither'])
const BOUNDARIES = [20, 10, 5, 3]

export default class EntityDetector {
    constructor(bot, observationBus, { cooldownMs = 2_000, hysteresis = 0.5, now = Date.now } = {}) {
        this.bot = bot
        this.bus = observationBus
        this.cooldownMs = cooldownMs
        this.hysteresis = hysteresis
        this.now = now
        this.tracked = new Map()
        this.started = false
        this.listeners = {
            entitySpawn: entity => this.update(entity),
            entityMoved: entity => this.update(entity),
            entityUpdate: entity => this.update(entity),
            entityGone: entity => this.remove(entity?.id),
            move: () => this.refresh(),
            spawn: () => this.seed(),
            respawn: () => this.tracked.clear()
        }
    }

    start() {
        if (this.started) return
        this.started = true
        this.seed()
        for (const [event, listener] of Object.entries(this.listeners)) this.bot.on(event, listener)
    }

    stop() {
        for (const [event, listener] of Object.entries(this.listeners)) this.bot.removeListener(event, listener)
        this.started = false
        this.tracked.clear()
    }

    describe(entity) {
        const origin = positionData(this.bot.entity?.position)
        const position = positionData(entity?.position)
        if (!origin || !position || entity.id == null || entity.id === this.bot.entity?.id || entity.isValid === false) return null
        const entityType = entity.name || entity.type || 'unknown'
        return {
            entityId: entity.id,
            entityType,
            username: entity.username || null,
            distance: distanceBetween(origin, position),
            direction: directionBetween(origin, position),
            relativeDirection: relativeDirection(this.bot.entity?.yaw, origin, position),
            position,
            hostile: HOSTILE.has(entityType)
        }
    }

    zone(distance) {
        return BOUNDARIES.reduce((zone, boundary) => zone + Number(distance <= boundary), 0)
    }

    seed() {
        this.tracked.clear()
        for (const entity of Object.values(this.bot.entities || {})) {
            const data = this.describe(entity)
            if (!data || data.distance > BOUNDARIES[0]) continue
            this.tracked.set(data.entityId, {
                data, zone: this.zone(data.distance), lastEmitted: -Infinity, lastAlertZone: 0
            })
        }
    }

    refresh() {
        for (const entity of Object.values(this.bot.entities || {})) this.update(entity)
    }

    update(entity) {
        if (!this.started) return
        const data = this.describe(entity)
        if (!data) return
        const previous = this.tracked.get(data.entityId)
        if (!previous) {
            if (data.distance > BOUNDARIES[0]) return
            const zone = this.zone(data.distance)
            this.tracked.set(data.entityId, { data, zone, lastEmitted: this.now(), lastAlertZone: zone })
            this.publish('entity.appeared', data)
            return
        }
        let zone = previous.zone
        while (zone < BOUNDARIES.length && data.distance <= BOUNDARIES[zone] - this.hysteresis) zone++
        while (zone > 0 && data.distance > BOUNDARIES[zone - 1] + this.hysteresis) zone--
        if (zone === 0) {
            this.remove(data.entityId, data)
            return
        }
        previous.data = data
        if (zone <= previous.zone) {
            previous.zone = zone
            return
        }
        // Urgent escalation is never hidden by the movement cooldown.
        const urgentEscalation = zone >= 3 && zone > previous.lastAlertZone
        if (!urgentEscalation && this.now() - previous.lastEmitted < this.cooldownMs) return
        previous.zone = zone
        previous.lastEmitted = this.now()
        previous.lastAlertZone = zone
        this.publish(zone === 4 ? 'entity.very_close' : zone === 3 ? 'entity.near' : 'entity.approaching', data)
    }

    remove(id, currentData) {
        const previous = this.tracked.get(id)
        if (!previous) return
        this.tracked.delete(id)
        this.publish('entity.disappeared', currentData || previous.data)
    }

    publish(type, data) {
        let priority = 'info'
        if (type !== 'entity.disappeared' && data.hostile) {
            if (data.distance <= 3) priority = 'danger'
            else if (data.distance <= 10) priority = 'warning'
        }
        const observation = { type, priority, data }
        this.bus.emit(observation)
        return observation
    }

    getSnapshot({ radius = 20, limit = 12 } = {}) {
        const entities = Object.values(this.bot.entities || {}).map(entity => this.describe(entity))
            .filter(data => data && data.distance <= radius).sort((a, b) => a.distance - b.distance)
        return { entities: entities.slice(0, limit), radius, truncated: entities.length > limit }
    }

    scan(options) {
        const observation = { type: 'entities.snapshot', priority: 'info', data: this.getSnapshot(options) }
        this.bus.emit(observation)
        return observation
    }
}
