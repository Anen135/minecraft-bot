import { distanceBetween, positionData } from '../spatial.js'

export default class LookDetector {
    constructor(bot, observationBus) {
        this.bot = bot
        this.observationBus = observationBus
    }

    start() {}

    stop() {}

    getSnapshot() {
        if (!positionData(this.bot.entity?.position)) {
            return { kind: 'none', available: false, name: null, distance: null, position: null }
        }
        const self = this.bot.entity
        let block
        const eyeHeight = self.eyeHeight ?? self.height
        const eyePosition = positionData(self.position)
        if (Number.isFinite(eyeHeight)) eyePosition.y += eyeHeight
        let usedWorldRaycast = false
        if (typeof this.bot.world?.raycast === 'function' && typeof self.position.offset === 'function' &&
            Number.isFinite(self.yaw) && Number.isFinite(self.pitch) && Number.isFinite(eyeHeight)) {
            // Mineflayer 4.39's blockAtCursor rejects zero yaw/pitch. The public
            // world raycast also gives a consistent eye-origin hit for occlusion.
            const direction = { x: -Math.sin(self.yaw) * Math.cos(self.pitch),
                y: Math.sin(self.pitch), z: -Math.cos(self.yaw) * Math.cos(self.pitch) }
            block = this.bot.world.raycast(self.position.offset(0, eyeHeight, 0), direction, 6)
            usedWorldRaycast = true
        } else {
            block = this.bot.blockAtCursor?.(6)
            // Native blockAtCursor uses entity.height rather than eyeHeight.
            if (Number.isFinite(self.height)) eyePosition.y = self.position.y + self.height
        }
        const intersection = positionData(block?.intersect)
        const blockDistance = intersection ? distanceBetween(eyePosition, intersection) : null
        const entity = this.bot.entityAtCursor?.(blockDistance === null ? 6 : Math.min(6, blockDistance))
        if (entity) {
            return {
                kind: 'entity', available: true,
                name: entity.username ?? entity.name ?? entity.displayName ?? null,
                entityId: entity.id ?? null,
                distance: distanceBetween(this.bot.entity.position, entity.position),
                distanceApproximate: true,
                position: positionData(entity.position)
            }
        }
        if (block) {
            return {
                kind: 'block', available: true, name: block.name ?? null,
                distance: distanceBetween(eyePosition, intersection ?? block.position),
                distanceApproximate: !intersection || !Number.isFinite(self.height ?? eyeHeight),
                position: positionData(block.position)
            }
        }
        return {
            kind: 'none', available: usedWorldRaycast || typeof this.bot.blockAtCursor === 'function' || typeof this.bot.entityAtCursor === 'function',
            name: null, distance: null, position: null
        }
    }

    scan() {
        const observation = { type: 'look.snapshot', priority: 'info', data: this.getSnapshot() }
        this.observationBus.emit(observation)
        return observation
    }
}
