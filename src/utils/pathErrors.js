// Errors thrown by mineflayer-pathfinder when navigation ends without reaching the goal.

// The goal was cancelled on purpose (!stop, or another command set a new goal).
export function isInterrupted(error) {
    return error?.name === 'PathStopped' || error?.name === 'GoalChanged'
}

export function isNoPath(error) {
    return error?.name === 'NoPath'
}
