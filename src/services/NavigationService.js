import pathfinder from 'mineflayer-pathfinder'
import PlayerService from './PlayerService.js'
import { interruptedErrors } from '../utils/pathErrors.js'

const { goals } = pathfinder
const { GoalBlock, GoalFollow } = goals

// NavigationService — вся навигационная Mineflayer/Pathfinder-логика.
// Команды только разбирают пользовательский ввод и вызывают методы сервиса.

export default class NavigationService {
    constructor(bot) {
        this.bot = bot
        this.players = new PlayerService(bot)
    }

    // Идти к точным координатам (GoalBlock).
    // Возвращает true, если бот прибыл; false при игровой ошибке пути.
    // Прерывания (!stop, новая цель) молча завершают движение.
    async goto(x, y, z) {
        this.bot.chat(`Going to ${x} ${y} ${z}`)

        try {
            await this.bot.pathfinder.goto(new GoalBlock(x, y, z))
            this.bot.chat('Arrived.')
            return true
        } catch (error) {
            if (interruptedErrors.includes(error.name)) return false
            if (error.name == 'NoPath') {
                this.bot.chat('No path to that position.')
                return false
            }
            throw error
        }
    }

    // Идти к игроку по нику. Позиция берётся из мира на момент вызова.
    async gotoPlayer(username) {
        const coords = this.players.getPosition(username)
        if (!coords) {
            this.bot.chat(`I cannot see ${username}.`)
            return false
        }
        return this.goto(coords.x, coords.y, coords.z)
    }

    // Постоянное следование за игроком (GoalFollow, dynamic).
    async follow(username, distance = 2) {
        const entity = this.players.getEntity(username)
        if (!entity) {
            this.bot.chat(`I cannot see ${username}.`)
            return false
        }
        this.bot.pathfinder.setGoal(new GoalFollow(entity, distance), true)
        this.bot.chat(`Following ${username}.`)
        return true
    }

    stop() {
        this.bot.pathfinder.stop()
        this.bot.clearControlStates()
    }
}

