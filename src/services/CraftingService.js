import minecraftData from 'minecraft-data'

// CraftingService — базовый крафт через Mineflayer (этап 1 MVP).
// Сложное дерево рецептов и автоматический planner — вне рамок этого этапа.

export default class CraftingService {
    constructor(bot) {
        this.bot = bot
    }

    getMcData() {
        return minecraftData(this.bot.version)
    }

    // Найти рецепты по имени предмета (или part of the item name match by exact name).
    findRecipes(itemName) {
        const mcData = this.getMcData()
        const item = mcData.itemsByName[itemName]
        if (!item) return []
        return this.bot.recipesFor(item.id, null, 1, null)
    }

    // Выкрафтить предмет (опционально несколько раз). Бросает ошибку с понятным именем,
    // если предмет или рецепт неизвестен либо не хватает материалов.
    async craft(itemName, count = 1) {
        const recipes = this.findRecipes(itemName)
        if (!recipes.length) {
            const error = new Error(`No crafting recipe for ${itemName} (or missing materials).`)
            error.name = 'UnknownRecipe'
            throw error
        }

        for (let i = 0; i < count; i++) {
            const [recipe] = this.findRecipes(itemName)
            if (!recipe) {
                const error = new Error(`Not enough materials to craft ${itemName}.`)
                error.name = 'MissingMaterials'
                throw error
            }
            await this.bot.craft(recipe)
        }

        this.bot.chat(`Crafted ${count}x ${itemName}.`)
        return true
    }
}
