# TODO - Central Orchestration and Core Abilities

The bot remains manually controlled. `BotManager` owns subsystem managers and supplies individual frozen contracts. Managers know only their own components and contract; they do not import one another.

```text
Inputs -> InputManager -> InputContract -> BotManager -> CommandManager
Handlers -> CommandContract -> ServiceManager -> Services -> Mineflayer
Detectors -> ObservationBus -> Reporter + PerceptionContract -> BotManager
```

The orchestrator creates contract implementations, including the explicit service and perception forwards in `CommandContract`. See the [README architecture section](../README.md#current-architecture) for manager APIs, initialization order, and lifecycle details.

## Completed

- [x] Centralized creation and cleanup of inputs, commands, services, perception, states, and plugins in `BotManager`.
- [x] Individual `InputContract`, `CommandContract`, `PerceptionContract`, `StateContract`, `PluginContract`, and `ServiceContract`, protected with `Object.freeze()`.
- [x] Real consumers for every contract method; empty contracts for states/plugins/services that have no cross-subsystem requests yet.
- [x] `InputManager` owns one process-wide console and one chat input per connection.
- [x] `CommandManager` owns its loader, registry, and handlers, passes `{ username, args, reply, contract }`, and isolates command errors.
- [x] Commands call the contract without receiving a bot, other managers, or importing services.
- [x] `ServiceManager` reuses existing static services and owns `MemoryService`; disposed sessions cannot operate on a replacement bot.
- [x] Preserved goto/follow forms and all 14 existing chat/console commands and their replies.
- [x] `!stop` preserves pathfinder, collection, active digging, and movement cancellation.
- [x] `PerceptionManager` owns its reporter, detectors, bus, and orchestrator subscription; detector code and observation format are unchanged.
- [x] Preserved entity-zone and sound filtering and on-demand perception snapshots.
- [x] Moved command files into their subsystem, `BehaviorManager` into the minimal `StateManager`, and the application plugin registry into `plugins/`.
- [x] Reconnect replaces session managers/contracts, removes old listeners, and retains the same console.
- [x] Initialization failures and cleanup errors release session resources and are diagnosed locally.
- [x] Regression tests cover contracts, ownership, commands, observations, stale sessions, asynchronous errors, and Ctrl+C process shutdown.
- [x] README documents manager APIs, individual contracts, initialization order, and implementation limits.

## Next Manual Abilities

- [ ] Expand core services as real functionality is added.
- [ ] Add manual smelting.
- [ ] Add a manual building/place API.
- [ ] Add a combat API.
- [ ] Add food, sleep, farming, and container operations.
- [ ] Cover all survival core abilities with commands.
- [ ] Add waypoint/home commands using the existing `MemoryService`.
- [ ] Add access control/whitelist; `OWNER_NAME` is not checked yet.
- [ ] Persist memory and restore selected state after shutdown; current shutdown already closes inputs and cancels existing actions.
- [ ] Test behavior on a live Minecraft server; current perception tests use mocks and do not establish live-server behavior.
- [ ] Resolve collectblock cancellation limits during tool equipping and item pickup without changing the user interface.

## LATER

- [ ] TaskManager and composite tasks.
- [ ] ProductionPlanner and recipe dependency graph.
- [ ] Autonomous resource gathering and automatic tool/crafting table creation.
- [ ] Autonomous guard/patrol/survival behavior.
- [ ] Persistent memory and action recovery after respawn/reconnect.
- [ ] Additional control interfaces and multi-bot coordination.

Tasks, TaskManager, Planner, and AI are not implemented. Future subsystems should receive their own explicit contracts from `BotManager`; do not bypass manager boundaries with direct imports or universal string operations. See [future automation](taskmanager.md).
