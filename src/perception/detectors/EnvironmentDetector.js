import { positionData } from '../spatial.js'

export default class EnvironmentDetector {
    constructor(bot, observationBus) {
        this.bot = bot
        this.observationBus = observationBus
    }

    start() {}

    stop() {}

    getSnapshot() {
        const entity = this.bot.entity
        let current = null
        let ground = null
        let ahead = null
        let above = null
        if (positionData(entity?.position) && typeof this.bot.blockAt === 'function') {
            // Preserve Vec3 methods for Mineflayer; coordinate-only mocks need no world methods.
            const base = typeof entity.position.floored === 'function'
                ? entity.position.floored()
                : { x: Math.floor(entity.position.x), y: Math.floor(entity.position.y), z: Math.floor(entity.position.z) }
            current = this.bot.blockAt(base)
            ground = this.bot.blockAt(typeof base.offset === 'function'
                ? base.offset(0, -1, 0) : { ...base, y: base.y - 1 })
            above = this.bot.blockAt(typeof base.offset === 'function'
                ? base.offset(0, 2, 0) : { ...base, y: base.y + 2 })
            if (Number.isFinite(entity.yaw)) {
                const dx = Math.round(-Math.sin(entity.yaw))
                const dz = Math.round(-Math.cos(entity.yaw))
                ahead = this.bot.blockAt(typeof base.offset === 'function'
                    ? base.offset(dx, 0, dz) : { ...base, x: base.x + dx, z: base.z + dz })
            }
        }
        const biome = current?.biome
        const biomeId = typeof biome === 'number' ? biome : biome?.id
        return {
            biome: biome?.name ?? this.bot.registry?.biomes?.[biomeId]?.name ?? null,
            time: Number.isFinite(this.bot.time?.timeOfDay) ? this.bot.time.timeOfDay : null,
            isDay: typeof this.bot.time?.isDay === 'boolean' ? this.bot.time.isDay : null,
            weather: {
                raining: typeof this.bot.isRaining === 'boolean' ? this.bot.isRaining : null,
                rainState: Number.isFinite(this.bot.rainState) ? this.bot.rainState : null,
                thunderState: Number.isFinite(this.bot.thunderState) ? this.bot.thunderState : null
            },
            light: Number.isFinite(current?.light) ? current.light : null,
            skyLight: Number.isFinite(current?.skyLight) ? current.skyLight : null,
            groundBlock: ground?.name ?? null,
            blockAhead: ahead?.name ?? null,
            blockAbove: above?.name ?? null,
            dimension: this.bot.game?.dimension ?? null
        }
    }

    scan() {
        const observation = { type: 'environment.snapshot', priority: 'info', data: this.getSnapshot() }
        this.observationBus.emit(observation)
        return observation
    }
}
