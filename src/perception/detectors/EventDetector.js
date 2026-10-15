import { positionData, distanceBetween, directionBetween, relativeDirection } from '../spatial.js'

const IMPORTANT_SOUNDS = new Set(['entity.creeper.primed', 'entity.generic.explode', 'entity.zombie.ambient',
    'entity.skeleton.ambient', 'block.chest.open', 'block.chest.close', 'block.wooden_door.open',
    'block.wooden_door.close', 'block.iron_door.open', 'block.iron_door.close'])

export default class EventDetector {
    constructor(bot, observationBus, { soundRadius = 16, soundCooldownMs = 3_000, now = Date.now } = {}) {
        this.bot = bot
        this.bus = observationBus
        this.soundRadius = soundRadius
        this.soundCooldownMs = soundCooldownMs
        this.now = now
        this.started = false
        this.sounds = new Map()
        this.listeners = {
            health: () => this.vitals(),
            breath: () => this.breath(),
            death: () => this.bus.emit({ type: 'player.death', priority: 'danger', data: {} }),
            respawn: () => {
                this.reset()
                this.bus.emit({ type: 'player.respawn', priority: 'info', data: {} })
            },
            spawn: () => this.reset(),
            playerCollect: (collector, collected) => this.collect(collector, collected),
            rain: () => this.weather(),
            weatherUpdate: () => this.weather(),
            soundEffectHeard: (name, position, volume, pitch) => this.sound(name, position, volume, pitch)
        }
    }

    start() {
        if (this.started) return
        this.started = true
        this.reset()
        for (const [event, listener] of Object.entries(this.listeners)) this.bot.on(event, listener)
    }

    stop() {
        for (const [event, listener] of Object.entries(this.listeners)) this.bot.removeListener(event, listener)
        this.started = false
        this.reset()
    }

    reset() {
        this.health = Number.isFinite(this.bot.health) ? this.bot.health : null
        this.food = Number.isFinite(this.bot.food) ? this.bot.food : null
        this.oxygen = Number.isFinite(this.bot.oxygenLevel) ? this.bot.oxygenLevel : null
        this.isRaining = typeof this.bot.isRaining === 'boolean' ? this.bot.isRaining : null
        this.sounds.clear()
    }

    vitals() {
        for (const name of ['health', 'food']) {
            const current = this.bot[name]
            const previous = this[name]
            if (!Number.isFinite(current)) continue
            this[name] = current
            if (previous == null || previous === current) continue
            const priority = name === 'health' && current <= 4 ? 'danger'
                : current < previous ? 'warning' : 'info'
            this.bus.emit({ type: `${name}.changed`, priority,
                data: { previous, current, difference: current - previous } })
        }
    }

    breath() {
        const current = this.bot.oxygenLevel
        const previous = this.oxygen
        if (!Number.isFinite(current)) return
        this.oxygen = current
        if (previous == null || current === previous) return
        const zone = value => value <= 0 ? 0 : value <= 5 ? 1 : value <= 10 ? 2 : value < 20 ? 3 : 4
        if (zone(previous) === zone(current)) return
        const data = { previous, current, difference: current - previous }
        this.bus.emit({ type: 'oxygen.changed', priority: current <= 5 ? 'danger' : 'info', data })
        if (current <= 5 && (previous > 5 || current <= 0 && previous > 0)) {
            this.bus.emit({ type: 'oxygen.critical', priority: 'danger', data })
        }
    }

    collect(collector, collected) {
        if (this.bot.entity?.id == null || collector?.id !== this.bot.entity.id || !collected) return
        let item
        // This public API decodes version-specific metadata; never guess metadata indexes.
        try { item = collected.getDroppedItem?.() } catch { return }
        if (!item?.name || !Number.isFinite(item.count) || item.count <= 0) return
        this.bus.emit({ type: 'item.collected', priority: 'info',
            // The public event omits the actual pickup count; almost-full
            // inventories can collect only part of this observed ground stack.
            data: { entityId: collected.id ?? null, itemName: item.name, count: null, observedStackCount: item.count } })
    }

    weather() {
        const current = this.bot.isRaining
        const previous = this.isRaining
        if (typeof current !== 'boolean') return
        this.isRaining = current
        if (previous == null || previous === current) return
        this.bus.emit({ type: 'weather.changed', priority: 'info', data: { previous, current, isRaining: current } })
    }

    sound(name, rawPosition, volume, pitch) {
        if (typeof name !== 'string') return
        const soundName = name.replace(/^minecraft:/, '')
        if (!IMPORTANT_SOUNDS.has(soundName)) return
        const origin = positionData(this.bot.entity?.position)
        const position = positionData(rawPosition)
        if (!origin || !position) return
        const distance = distanceBetween(origin, position)
        if (distance > this.soundRadius) return
        const lastHeard = this.sounds.get(soundName)
        if (lastHeard != null && this.now() - lastHeard < this.soundCooldownMs) return
        this.sounds.set(soundName, this.now())
        this.bus.emit({ type: 'sound.heard',
            priority: soundName === 'entity.creeper.primed' || soundName === 'entity.generic.explode' ? 'danger' : 'info',
            data: { soundName, position, distance, direction: directionBetween(origin, position),
                relativeDirection: relativeDirection(this.bot.entity?.yaw, origin, position),
                volume: Number.isFinite(volume) ? volume : null, pitch: Number.isFinite(pitch) ? pitch : null } })
    }
}
