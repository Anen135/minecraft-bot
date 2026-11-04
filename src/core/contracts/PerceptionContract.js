export function createPerceptionContract(botManager) {
    return Object.freeze({
        publishObservation: observation => botManager.onObservation?.(observation)
    })
}
