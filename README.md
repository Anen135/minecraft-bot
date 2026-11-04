# Minecraft Bot

A Mineflayer bot controlled manually through Minecraft chat and the local console. Commands expose core abilities, while Perception turns selected game state and events into structured observations for console output. Autonomous behavior is not implemented yet.

## Getting started

Requires Node.js with ESM and `node --test` support.

```sh
npm ci
npm start
```

Configuration is read from `.env`: `MC_HOST` (default `127.0.0.1`), `MC_PORT` (`25565`), `MC_USERNAME` (`AnenBot`), `MC_AUTH` (`offline`), and `BOT_PREFIX` (`!`). Set `MC_AUTH=microsoft` to use Microsoft authentication. `OWNER_NAME` supplies the local console command username (default `Anen`); it does not restrict command access, so any player in chat can still use commands.

## Commands

Examples use the default `!` prefix.

| Command | Action |
| --- | --- |
| `!help` | List commands |
| `!goto` | Go to the current position of the player who issued the command |
| `!goto Steve` | Go to a visible player's current position |
| `!goto 10 64 -20` | Go to the given coordinates |
| `!follow [player]` | Follow a player; defaults to the player who issued the command |
| `!stop` | Stop navigation, block collection, and movement |
| `!inventory` | List inventory contents |
| `!chop` | Find nearby regular logs and collect connected blocks |
| `!mine <block> [count]` | Mine the requested number of nearby blocks |
| `!equip <item> [destination]` | Equip an item from inventory |
| `!craft <item> [count]` | Craft the requested number of items from available resources |
| `!status` | Show the bot's health, food, oxygen, position, facing, held item, and game mode |
| `!look` | Show the block or entity under the bot's cursor |
| `!nearby` | List nearby entities, up to 20 blocks away |
| `!environment` | Show local biome, time, weather, light, dimension, and nearby block names |
| `!scan` | Combine status, look, nearby entities, and environment into one report |

The Perception commands are intended for local console use. Their observations are written to the bot process console, including when the command was requested through Minecraft chat.

Use Minecraft registry names such as `oak_log`, `cobblestone`, and `wooden_pickaxe`. The count must be a positive integer and defaults to `1`. Equipment destinations are `hand` (the default), `off-hand`, `head`, `torso`, `legs`, and `feet`.

Crafting does not gather resources or build a crafting table. Recipes that use a 3×3 grid require an existing accessible table nearby. The requested count means output items; when a recipe yields multiple items, the result is rounded up to a whole number of crafting operations. Mining searches nearby blocks and depends on available tools and a valid path. `!chop` collects up to 64 connected logs; it does not identify the full geometry of a tree.

`!stop` clears collection and navigation targets, interrupts active digging, and clears control states. The `collectblock` plugin has cancellation limits: an equipment operation that is already underway can be followed by one last dig, and its wait for a dropped item can remain pending inside the plugin. The stop command does not wait forever for that operation. Use `!stop` before starting another action after mining; full coordination of concurrent actions is deferred.

## Current architecture

`index.js` creates one `BotManager`, starts it, and forwards process shutdown signals. `BotManager` owns the subsystem managers, creates their individual contracts, and coordinates their lifecycles. Managers do not import or receive other managers.

```text
Application -> BotManager
                 |-- inputs      -> ChatInput, ConsoleInput
                 |-- commands    -> CommandLoader, CommandRegistry, handlers
                 |-- perception  -> ObservationBus, detectors, reporter
                 |-- states      -> manually supplied state/behavior
                 |-- plugins     -> registered application plugins
                 `-- services    -> navigation, mining, crafting, inventory, memory
```

Input and action flow:

```text
ChatInput / ConsoleInput
  -> InputManager -> InputContract -> BotManager
  -> CommandManager -> handler -> CommandContract
  -> ServiceManager -> existing service -> Mineflayer
```

The contract implementation belongs to the orchestrator. A command handler calls an explicit method such as `contract.mine('oak_log', 10)`; it does not get a service manager, perception manager, or Mineflayer bot. There is no generic operation dispatcher, service locator, or dependency container.

### Managers and contracts

| Manager | Owned components and public API | Received contract |
| --- | --- | --- |
| `BotManager` | Mineflayer connection and all subsystem managers; `start()`, `stop()`, `handleInput(input)` | Creates all contracts |
| `InputManager` | `ChatInput`, `ConsoleInput`; `start()`, `startSession(bot)`, `stopSession()`, `stop()` | `handleInput({ source, username, message, reply })`, `shutdown()` |
| `CommandManager` | `CommandLoader`, `CommandRegistry`, `handlers/`; `initialize()`, `handle(username, message, { reply })` | Explicit ability methods, perception queries, `playerPosition(username)`, `reply(message)` |
| `ServiceManager` | Existing static services and a `MemoryService` instance; `goto(x, y, z)`, `follow(username)`, `stop()`, `mine(block, count)`, `chopTree(options)`, `craft(item, count)`, `inventory()`, `equip(item, destination)`, `playerPosition(username)`, `dispose()` | Empty for now; services have no requests back to the orchestrator |
| `PerceptionManager` | Its `ObservationBus`, five detectors, and `ConsoleObservationReporter`; `start()`, `stop()`, `status()`, `look()`, `nearby()`, `environment()`, `scan()` | `publishObservation(observation)` |
| `StateManager` | Current manually supplied state/behavior; `start(behavior, options)`, `stop()` | Empty; no automatic states or cross-subsystem requests |
| `PluginManager` | Application plugin registry; `register(name, plugin)`, `get(name)`, `dispose()` | Empty; no active cross-subsystem plugin behavior |

All six contract factories are in `src/core/contracts/`; each returns a distinct `Object.freeze()` object. `CommandContract` exposes `goto`, `follow`, `stop`, `mine`, `chopTree`, `craft`, `inventory`, `equip`, `playerPosition`, `status`, `look`, `nearby`, `environment`, `scan`, and `reply`. Only explicit methods with real consumers are present. The three currently empty contracts reserve no capabilities and do not introduce fake operations.

### Commands and services

Handlers in `src/commands/handlers/` receive `{ username, args, reply, contract }`. They retain parsing, validation, overloaded forms, and response formatting. For example, `goto` keeps its caller/player/coordinate routing and obtains a copy of player coordinates through the contract. Equipment slot syntax is validated by the handler; the service still validates the requested operation.

`CommandManager.initialize()` loads and registers handlers once per manager. `handle()` checks the prefix, resolves a handler, prepares its context, and isolates execution errors. Both chat and console use the same registry. Console commands supply a local reply callback; chat replies use the session-bound command contract. Perception requests continue to print observations locally regardless of the input source.

`ServiceManager` delegates to the existing static service implementations without changing mining, navigation, crafting, or equipment algorithms. Each instance belongs to one bot session. Disposal clears its bot reference and requests the existing navigation/collection/digging stop operation. Old command contracts retain their original session capabilities and cannot start actions on a replacement bot. Operation statuses and expected error normalization remain unchanged.

### Perception and observations

Detectors publish `{ type, priority, data }` through the existing `ObservationBus`, using `debug`, `info`, `warning`, or `danger` priority. They do not send chat, format output, or call services. `PerceptionManager` starts and stops its reporter and its contract subscription alongside the detectors. Observation delivery errors are diagnosed locally, including rejected asynchronous consumers.

`BotManager` can receive the structured observations without parsing console output:

```js
const manager = new BotManager(config, {
    onObservation(observation) {
        // Consume observation.type, observation.priority, and observation.data.
    }
})
manager.start()
```

No autonomous reactions are attached. Snapshot queries publish on demand; there is no periodic status poll. Entity scans are capped at 12 results within 20 blocks. Passive notices use 20/10/5/3-block zones, hysteresis, and cooldowns. Selected sounds are filtered by name, range, and cooldown.

Look detection uses the public world raycast to avoid the installed Mineflayer cursor API's zero-angle limitation and clips entity selection at a block hit. Entity distances are approximate. Pickup events keep `count: null` and a separate `observedStackCount`, since a ground stack size does not establish how many items were actually collected. Sound observations depend on Mineflayer's `soundEffectHeard` event and do not guarantee that every game sound is exposed.

### Initialization and cleanup

1. Construct the process-wide `InputManager`. `start()` starts its console, creates Mineflayer, registers connection listeners, and loads the base pathfinder/collectblock plugins.
2. On the first spawn, configure movements and create session services, perception, states, plugins, and commands with their individual contracts.
3. Await command loading, then start perception and the session's chat input. The optional `onReady` lifecycle hook can return an additional cleanup callback. `sessionReady` tracks this initialization for callers that need to await it.
4. On disconnect, mark the session unavailable, detach chat and connection listeners, run the optional cleanup, stop states and game operations, clear the plugin registry, and stop perception/reporting. Cleanup errors are reported without skipping the other resources.
5. After cleanup, reconnect with capped exponential backoff. Create new session managers and contracts; keep the same console instance and readline listener. Input received while unavailable gets `[CONSOLE] Bot is not ready.`.
6. `stop()` closes the console, clears any reconnect timer, disposes the session, and quits Mineflayer. It returns a promise for pending cleanup. Ctrl+C and SIGTERM use this shutdown path.

Repeated starts while connected and repeated stops are safe. A disconnected or stopped session cannot become active again when delayed command loading completes. Initialization failures dispose partially created session resources before retrying. The console uses `OWNER_NAME` (default `Anen`), with the connected bot username as a fallback; this is not access control.

### Current limits

States and application plugins retain their existing minimal behavior/registry functionality but no autonomous states or plugins are started. The old behavior examples remain unused in `src/behaviors/`. `MemoryService` is in-memory and belongs to its service session; persistence and recovery across reconnects are not implemented. Existing unused core utilities do not participate in command routing.

TaskManager, Planner, AI, smelting, building, and new gameplay abilities are outside this refactor. The existing collectblock cancellation limits described above still apply. Tests use mocks; live-server compatibility is not established by those tests.

## Tests

```sh
npm test
```

Tests use mocks and do not require a Minecraft server. See [core abilities](todo/architecturetodo.md) and [future automation](todo/taskmanager.md) for the roadmap.
