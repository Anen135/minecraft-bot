// PlayerService — базовые операции с игроками (Mineflayer-логика).
// Команды не должны напрямую читать bot.players, если это можно вынести сюда.

export default class PlayerService {
    constructor(bot) {
        this.bot = bot
    }

    // Позиция entity указанного игрока или null, если игрок не виден.
    getPosition(username) {
        return this.bot.players[username]?.entity?.position ?? null
    }

    // Позиция игрока в виде массива координат [x, y, z] или null.
    getCoordinates(username) {
        const position = this.getPosition(username)
        return position ? [position.x, position.y, position.z] : null
    }

    // Entity игрока по нику или null.
    getEntity(username) {
        return this.bot.players[username]?.entity ?? null
    }

    // Позиция самого бота.
    getBotPosition() {
        return this.bot.entity?.position ?? null
    }
}
