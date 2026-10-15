import { directionFromYaw, positionData } from '../spatial.js'

export default class StatusDetector {
    constructor(bot, observationBus) {
        this.bot = bot
        this.observationBus = observationBus
    }

    start() {}

    stop() {}

    getSnapshot() {
        const entity = this.bot.entity
        return {
            position: positionData(entity?.position),
            health: Number.isFinite(this.bot.health) ? this.bot.health : null,
            food: Number.isFinite(this.bot.food) ? this.bot.food : null,
            oxygen: Number.isFinite(this.bot.oxygenLevel) ? this.bot.oxygenLevel : null,
            heldItem: this.bot.heldItem?.name ?? null,
            facing: {
                yaw: Number.isFinite(entity?.yaw) ? entity.yaw : null,
                pitch: Number.isFinite(entity?.pitch) ? entity.pitch : null,
                direction: directionFromYaw(entity?.yaw)
            },
            gameMode: this.bot.game?.gameMode ?? null
        }
    }

    scan() {
        const observation = { type: 'status.snapshot', priority: 'info', data: this.getSnapshot() }
        this.observationBus.emit(observation)
        return observation
    }
}
