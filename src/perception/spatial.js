const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const RELATIVE = ['FRONT', 'FRONT_RIGHT', 'RIGHT', 'BACK_RIGHT', 'BACK', 'BACK_LEFT', 'LEFT', 'FRONT_LEFT']

export function positionData(position) {
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) return null
    return { x: position.x, y: position.y, z: position.z }
}

export function distanceBetween(origin, target) {
    const from = positionData(origin)
    const to = positionData(target)
    if (!from || !to) return null
    return Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
}

export function directionFromYaw(yaw) {
    if (!Number.isFinite(yaw)) return null
    const index = Math.round(-yaw / (Math.PI / 4))
    return COMPASS[((index % 8) + 8) % 8]
}

export function directionBetween(origin, target) {
    const from = positionData(origin)
    const to = positionData(target)
    if (!from || !to || (from.x === to.x && from.z === to.z)) return null
    return directionFromYaw(Math.atan2(from.x - to.x, from.z - to.z))
}

export function relativeDirection(yaw, origin, target) {
    const from = positionData(origin)
    const to = positionData(target)
    if (!Number.isFinite(yaw) || !from || !to || (from.x === to.x && from.z === to.z)) return null
    const targetYaw = Math.atan2(from.x - to.x, from.z - to.z)
    const index = Math.round((yaw - targetYaw) / (Math.PI / 4))
    return RELATIVE[((index % 8) + 8) % 8]
}
