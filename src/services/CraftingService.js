export default class CraftingService {
    static async craft(bot, itemName, count = 1) {
        if (!Number.isSafeInteger(count) || count < 1) {
            return { status: 'error', code: 'invalid_count', message: 'Count must be a positive integer.' }
        }
        try {
            const item = bot.registry.itemsByName[itemName]
            if (!item) return { status: 'error', code: 'unknown_item', message: `Unknown item: ${itemName}.` }

            let table = null
            let recipe = bot.recipesFor(item.id, null, count, null)[0]
            if (!recipe) {
                const tableType = bot.registry.blocksByName.crafting_table
                if (tableType) table = bot.findBlock({ matching: tableType.id, maxDistance: 4 })
                if (table) recipe = bot.recipesFor(item.id, null, count, table)[0]
            }
            if (!recipe) {
                const hasRecipe = bot.recipesAll(item.id, null, table).length > 0
                return {
                    status: 'error',
                    code: hasRecipe ? 'missing_resources' : 'no_recipe',
                    message: hasRecipe
                        ? `Not enough resources to craft ${count} ${itemName}.`
                        : `No usable recipe for ${itemName}. A nearby crafting table may be required.`
                }
            }

            const iterations = Math.ceil(count / recipe.result.count)
            await bot.craft(recipe, iterations, recipe.requiresTable ? table : null)
            return { status: 'success', itemName, count: iterations * recipe.result.count }
        } catch (error) {
            return { status: 'error', code: 'craft_failed', message: error?.message || String(error) }
        }
    }
}
