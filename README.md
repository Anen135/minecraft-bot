# Minecraft Bot

A Mineflayer bot controlled manually through chat. The current project stage exposes core abilities through commands: navigation, inventory, mining, and simple crafting. Autonomous behavior is not implemented yet.

## Getting started

Requires Node.js with ESM and `node --test` support.

```sh
npm ci
npm start
```

Configuration is read from `.env`: `MC_HOST` (default `127.0.0.1`), `MC_PORT` (`25565`), `MC_USERNAME` (`AnenBot`), `MC_AUTH` (`offline`), and `BOT_PREFIX` (`!`). Set `MC_AUTH=microsoft` to use Microsoft authentication. `OWNER_NAME` does not restrict command access yet; any player in chat can use commands.

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

Use Minecraft registry names such as `oak_log`, `cobblestone`, and `wooden_pickaxe`. The count must be a positive integer and defaults to `1`. Equipment destinations are `hand` (the default), `off-hand`, `head`, `torso`, `legs`, and `feet`.

Crafting does not gather resources or build a crafting table. Recipes that use a 3×3 grid require an existing accessible table nearby. The requested count means output items; when a recipe yields multiple items, the result is rounded up to a whole number of crafting operations. Mining searches nearby blocks and depends on available tools and a valid path. `!chop` collects up to 64 connected logs; it does not identify the full geometry of a tree.

`!stop` clears collection and navigation targets, interrupts active digging, and clears control states. The `collectblock` plugin has cancellation limits: an equipment operation that is already underway can be followed by one last dig, and its wait for a dropped item can remain pending inside the plugin. The stop command does not wait forever for that operation. Use `!stop` before starting another action after mining; full coordination of concurrent actions is deferred.

## Current architecture

```text
User → Command → Service → Mineflayer
```

**Commands** (`src/commands/`) are the user interface: parsing, validation, routing, and output. They handle overloaded forms such as `goto`, player name selection, syntax checks, and chat replies.

**Services** (`src/services/`) implement core abilities: the Minecraft API, Goals, block search and collection, inventory, equipment, and crafting. Services do not parse chat or send user-facing messages. Commands import services directly; `CommandManager` passes only `{ bot, username, args }`.

Services receive the current `bot` on every call, so they do not retain a stale instance after reconnect:

```js
import NavigationService from './src/services/NavigationService.js'

await NavigationService.goto(bot, 100, 64, 200)
```

Available APIs: `NavigationService.goto/follow/stop`, `InventoryService.list/equip`, `MiningService.chopTree/mine`, and `CraftingService.craft`. Operation results include a `status`; expected execution errors and interruptions are normalized by the services. Unexpected navigation errors are passed to the caller. Commands format the result for chat.

The existing `core/`, `plugins/`, `behaviors/`, `utils/`, and `MemoryService` remain in place. Behavior and plugin stubs do not mean autonomous behavior is implemented. Tasks, TaskManager, Planner, and autonomous behavior may be added later on top of the Service API; they are not involved in command execution now.

## Tests

```sh
npm test
```

Tests use mocks and do not require a Minecraft server. See [core abilities](todo/architecturetodo.md) and [future automation](todo/taskmanager.md) for the roadmap.
