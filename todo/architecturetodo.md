# TODO — Core Abilities, Stage 1

Current stage: manual control of the bot's abilities. This plan replaces the earlier proposal for a broader architecture: a ServiceContainer, handlers, a new Command API, and a State Machine are not needed now.

```text
User → Command → Service → Mineflayer
```

Commands handle parsing, validation, routing, and output. Services implement abilities and handle Minecraft errors without knowing chat command syntax. They receive the current `bot` on each call, including after reconnect.

## Completed

- [x] Preserved the `commands/`, `services/`, `core/`, `plugins/`, `behaviors/`, and `utils/` structure.
- [x] `CommandLoader` loads and validates ESM commands; `CommandRegistry` rejects duplicates.
- [x] `CommandManager` parses the prefix, passes `{ bot, username, args }`, and isolates command errors.
- [x] `BotManager` creates the bot, loads pathfinder/collectblock, and reconnects with capped exponential backoff.
- [x] `NavigationService.goto(bot, x, y, z)`, `follow(bot, username)`, and `stop(bot)`.
- [x] Preserved `!goto`, `!goto <player>`, `!goto <x> <y> <z>`, and `!follow [player]`.
- [x] `!stop` stops block collection, navigation, and control states.
- [x] `InventoryService.list(bot)` and `equip(bot, itemName, destination)`; `!inventory` and `!equip`.
- [x] `MiningService.chopTree(bot)` and `mine(bot, blockName, count)`; `!chop` and `!mine`.
- [x] `CraftingService.craft(bot, itemName, count)`; `!craft` uses available resources without recursive crafting.
- [x] Unit tests use mocks for Service APIs, routing, and errors; no Minecraft server is required.
- [x] README describes the implemented manual controls and their limits.

## Next Manual Abilities

- [ ] Expand core services as real functionality is added.
- [ ] Add manual smelting.
- [ ] Add a manual building/place API.
- [ ] Add a combat API.
- [ ] Add food, sleep, farming, and container operations.
- [ ] Cover all survival core abilities with commands.
- [ ] Add waypoint/home commands using the existing `MemoryService`.
- [ ] Add access control/whitelist; `OWNER_NAME` is not checked yet.
- [ ] Add full process shutdown that cancels actions and saves memory.
- [ ] Test behavior on a live Minecraft server.
- [ ] Resolve collectblock cancellation limits during tool equipping and item pickup without changing the user interface.

## LATER

- [ ] TaskManager and composite tasks.
- [ ] ProductionPlanner and recipe dependency graph.
- [ ] Autonomous resource gathering and automatic tool/crafting table creation.
- [ ] Autonomous guard/patrol/survival behavior.
- [ ] Persistent memory and action recovery after respawn/reconnect.
- [ ] Additional control interfaces and multi-bot coordination.

Automation will call the same Service API. Existing EventBus, BehaviorManager, and plugin stubs are preserved, but are not required layers for current commands. See [future automation](taskmanager.md).
