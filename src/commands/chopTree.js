import MiningService from '../services/MiningService.js'

// Интерфейс: !chop ищет ближайшее дерево и рубит его — вся логика в MiningService.

export default {
    name: 'chop',

    async execute({ bot }) {
        await new MiningService(bot).chopTree()
    }
}
