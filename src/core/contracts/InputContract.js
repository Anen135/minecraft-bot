export function createInputContract(botManager) {
    return Object.freeze({
        handleInput: input => botManager.handleInput(input),
        shutdown: () => botManager.stop()
    })
}
