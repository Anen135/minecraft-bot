import { OBSERVATION_PRIORITIES } from './ObservationBus.js'

function number(value, digits = 1) {
    return Number.isFinite(value) ? String(Number(value.toFixed(digits))) : 'unknown'
}

function position(value) {
    return value ? `${number(value.x)} ${number(value.y)} ${number(value.z)}` : 'unknown'
}

function entityLine(entity) {
    const name = entity.username ? `Player ${entity.username}` : entity.entityType || 'Entity'
    return `${name} — ${number(entity.distance)}m ${entity.direction || 'unknown'}${entity.relativeDirection ? ` (${entity.relativeDirection})` : ''}`
}

function statusLines(data) {
    return [`HP: ${number(data.health)}/20 · Food: ${number(data.food)}/20 · Oxygen: ${number(data.oxygen)}/20`,
        `Position: ${position(data.position)} · Facing: ${data.facing?.direction || 'unknown'}`,
        `Held: ${data.heldItem || 'none'} · Game mode: ${data.gameMode || 'unknown'}`]
}

function lookLine(data) {
    if (data.available === false) return 'Looking: cursor information unavailable.'
    if (data.kind === 'none') return 'Looking: nothing interesting in sight.'
    return `Looking at ${data.kind}: ${data.name || 'unknown'} — ${data.distanceApproximate ? '~' : ''}${number(data.distance)}m · ${position(data.position)}`
}

function nearbyLines(data) {
    const entities = data.entities || []
    return [`Nearby (${number(data.radius, 0)}m):`,
        ...(entities.length ? entities.map(entityLine) : ['No entities detected.']),
        ...(data.truncated ? ['Additional nearby entities omitted.'] : [])]
}

function environmentLines(data) {
    const time = data.isDay === true ? 'day' : data.isDay === false ? 'night' : 'unknown'
    const weather = data.weather?.raining === true ? 'rain' : data.weather?.raining === false ? 'dry' : 'unknown'
    return [`Environment: ${data.biome || 'unknown biome'} · ${time} (${number(data.time, 0)} ticks) · ${weather}`,
        `Light: ${number(data.light, 0)} · Sky light: ${number(data.skyLight, 0)} · Dimension: ${data.dimension || 'unknown'}`,
        `Ground: ${data.groundBlock || 'unknown'} · Ahead: ${data.blockAhead || 'unknown'} · Above: ${data.blockAbove || 'unknown'}`]
}

export function formatObservation({ type, priority, data }) {
    const prefix = priority === 'danger' ? '[!!]' : priority === 'warning' ? '[!]' : '[INFO]'
    switch (type) {
        case 'status.snapshot': return statusLines(data).join('\n')
        case 'look.snapshot': return lookLine(data)
        case 'entities.snapshot': return nearbyLines(data).join('\n')
        case 'environment.snapshot': return environmentLines(data).join('\n')
        case 'scan.snapshot': return [...statusLines(data.status), lookLine(data.look),
            ...nearbyLines(data.nearby), ...environmentLines(data.environment)].join('\n')
        case 'health.changed': return `${prefix} [HP] ${number(data.previous)} → ${number(data.current)}`
        case 'food.changed': return `${prefix} [FOOD] ${number(data.previous)} → ${number(data.current)}`
        case 'oxygen.changed': return `${prefix} [OXYGEN] ${number(data.previous)} → ${number(data.current)}`
        case 'oxygen.critical': return `[!!] Oxygen critically low: ${number(data.current ?? data.oxygen)}/20.`
        case 'player.death': return '[!!] You died.'
        case 'player.respawn': return '[WORLD] Respawned.'
        case 'item.collected': return `[+] Picked up ${data.itemName || 'item'}${Number.isFinite(data.count) ? ` x${data.count}` : ''}.`
        case 'weather.changed': return `[WORLD] ${data.isRaining ? 'Rain started.' : 'Rain stopped.'}`
        case 'sound.heard': return `${prefix} [SOUND] ${data.soundName} — ~${number(data.distance)}m ${data.direction || 'unknown'}${data.relativeDirection ? ` (${data.relativeDirection})` : ''}`
        case 'entity.appeared': return `${prefix} Detected: ${entityLine(data)}`
        case 'entity.disappeared': return `${prefix} No longer nearby: ${entityLine(data)}`
        case 'entity.approaching': return `${prefix} Approaching: ${entityLine(data)}`
        case 'entity.near': return `${prefix} Nearby: ${entityLine(data)}`
        case 'entity.very_close': return `${prefix} Very close: ${entityLine(data)}`
        default: return null
    }
}

export default class ConsoleObservationReporter {
    constructor(bus, { write = console.log, minPriority = 'info' } = {}) {
        if (!OBSERVATION_PRIORITIES.includes(minPriority)) throw new TypeError('Unknown observation priority.')
        this.bus = bus
        this.write = write
        this.minPriority = minPriority
        this.unsubscribe = null
    }

    start() {
        if (this.unsubscribe) return
        this.unsubscribe = this.bus.on(observation => {
            const active = observation.type.endsWith('.snapshot')
            if (!active && OBSERVATION_PRIORITIES.indexOf(observation.priority) < OBSERVATION_PRIORITIES.indexOf(this.minPriority)) return
            const text = formatObservation(observation)
            if (text !== null) this.write(text)
        })
    }

    stop() {
        this.unsubscribe?.()
        this.unsubscribe = null
    }
}
