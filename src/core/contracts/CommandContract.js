export function createCommandContract(botManager) {
    // Bind a command session to its own capabilities, never a replacement connection.
    const { bot, services, perception } = botManager
    return Object.freeze({
        goto: (x, y, z) => services.goto(x, y, z),
        follow: username => services.follow(username),
        stop: () => services.stop(),
        mine: (block, count) => services.mine(block, count),
        chopTree: options => services.chopTree(options),
        craft: (item, count) => services.craft(item, count),
        inventory: () => services.inventory(),
        equip: (item, destination) => services.equip(item, destination),
        playerPosition: username => services.playerPosition(username),
        status: () => perception.status(),
        look: () => perception.look(),
        nearby: () => perception.nearby(),
        environment: () => perception.environment(),
        scan: () => perception.scan(),
        reply: message => botManager.replyChat(bot, message)
    })
}
