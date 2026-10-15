# TODO — Core Abilities and Perception

Current stage: manual control of the bot's abilities. This plan replaces the earlier proposal for a broader architecture: a ServiceContainer, handlers, a new Command API, and a State Machine are not needed now.

```text
INPUT
User → Commands → Services → Mineflayer

OUTPUT
User ← Console ← Observations ← Perception ← Mineflayer
```

Commands handle parsing, validation, routing, and command replies. Services implement abilities and handle Minecraft errors without knowing chat command syntax. They receive the current `bot` on each call, including after reconnect. Perception detectors observe bot state and Mineflayer events, publish structured records through `ObservationBus`, and leave human-readable formatting to `ConsoleObservationReporter`.

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
- [x] Added `src/perception/` with a structured `ObservationBus`, status/entity/look/environment/event detectors, and a console reporter.
- [x] Added local console input using the existing command registry and prefix; perception commands are `!status`, `!look`, `!nearby`, `!environment`, and `!scan`.
- [x] Integrated perception and reporter into each bot connection lifecycle; listeners are stopped on disconnect and recreated after reconnect.
- [x] Filtered passive entity notices by distance-zone changes and selected sound notices by name, range, and cooldown.
- [x] Unit tests use mocks for Service APIs, routing, and errors; no Minecraft server is required.
- [x] README describes both command input and perception output paths, plus their limits.

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
- [ ] Test behavior on a live Minecraft server; current perception tests use mocks and do not establish live-server behavior.
- [ ] Resolve collectblock cancellation limits during tool equipping and item pickup without changing the user interface.

## LATER

- [ ] TaskManager and composite tasks.
- [ ] ProductionPlanner and recipe dependency graph.
- [ ] Autonomous resource gathering and automatic tool/crafting table creation.
- [ ] Autonomous guard/patrol/survival behavior.
- [ ] Persistent memory and action recovery after respawn/reconnect.
- [ ] Additional control interfaces and multi-bot coordination.

Tasks, TaskManager, Planner, and AI are not implemented. Future automation can consume structured observations and call the same Service API. Existing EventBus, BehaviorManager, and plugin stubs are preserved, but are not required layers for current commands. See [future automation](taskmanager.md).
