// Errors thrown by mineflayer-pathfinder when navigation ends without reaching the goal.

// The goal was cancelled on purpose (!stop, or another command set a new goal).
export const interruptedErrors = ['PathStopped', 'GoalChanged']