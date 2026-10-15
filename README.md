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

The project has an input path for user-requested actions and an output path for information from the game:

```text
INPUT
User → Commands → Services → Mineflayer

OUTPUT
User ← Console ← Observations ← Perception ← Mineflayer
```

**Commands** (`src/commands/`) are the user interface: parsing, validation, routing, and output. They handle overloaded forms such as `goto`, player name selection, syntax checks, and chat replies.

**Services** (`src/services/`) implement core abilities: the Minecraft API, Goals, block search and collection, inventory, equipment, and crafting. Services do not parse chat or send user-facing messages. Commands import services directly; `CommandManager` passes `{ bot, username, args }` and the current per-bot perception manager when attached. Local console invocations also receive a `reply` callback for commands that respond to their caller.

**Perception** (`src/perception/`) observes Mineflayer state and events. Its detectors publish structured observations such as `health.changed`, `entity.near`, and `sound.heard` to `ObservationBus`; `ConsoleObservationReporter` formats those records for people. The manager starts and stops detectors for each bot connection, so listeners are removed on disconnect and recreated after reconnect. Passive entity notices are limited to meaningful distance-zone transitions, and selected sounds are filtered by name, range, and cooldown. Snapshot commands do not run a periodic status poll.

The local console accepts the same `!` command syntax as chat. Existing ability commands continue to reply to their caller; perception reports are written locally to the process console. The console username uses `OWNER_NAME` (default `Anen`). This is not an access-control check. Ctrl+C stops console input and the current bot connection, including pending reconnects.

Detectors supply observations as `{ type, priority, data }`, with `debug`, `info`, `warning`, or `danger` priority. They do not print messages, send chat, or call services. An additional consumer can subscribe independently:

```js
const unsubscribe = perception.bus.on(observation => {
    // Read structured observation.data; no console parsing required.
})
unsubscribe()
```

`PerceptionManager.start()` / `stop()` own detector listeners. Its `status()`, `look()`, `nearby()`, `environment()`, and `scan()` methods publish on-demand snapshots. Entity scans are capped at 12 results within 20 blocks; passive detection uses 20/10/5/3-block zones, hysteresis, and cooldowns instead of reporting every movement.

Look detection uses the public world raycast to avoid the installed Mineflayer cursor API's zero-angle limitation, and clips entity selection at a block hit. Entity distances are approximate. Pickup events identify the item, but do not claim an exact count: Mineflayer's public collection event omits the actual pickup amount. The observation keeps `count: null` and a separate `observedStackCount` for the ground stack, which may be only partially collected.

Services receive the current `bot` on every call, so they do not retain a stale instance after reconnect:

```js
import NavigationService from './src/services/NavigationService.js'

await NavigationService.goto(bot, 100, 64, 200)
```

Available APIs: `NavigationService.goto/follow/stop`, `InventoryService.list/equip`, `MiningService.chopTree/mine`, and `CraftingService.craft`. Operation results include a `status`; expected execution errors and interruptions are normalized by the services. Unexpected navigation errors are passed to the caller. Commands format the result for chat or console through the reply callback.

The existing `core/`, `plugins/`, `behaviors/`, `utils/`, and `MemoryService` remain in place. Behavior and plugin stubs do not mean autonomous behavior is implemented. Tasks, TaskManager, Planner, and AI are not implemented; future automation can consume the structured observations and call the Service API, but it is not involved in command execution now. Sound observations depend on Mineflayer's `soundEffectHeard` event; this is a filtered event feed, not computer vision or a guarantee that every game sound is exposed.

## Tests

```sh
npm test
```

Tests use mocks and do not require a Minecraft server. See [core abilities](todo/architecturetodo.md) and [future automation](todo/taskmanager.md) for the roadmap.
