# TODO - Automation (LATER)

TaskManager, Planner, and an autonomous agent are not implemented. Users invoke abilities manually through input and command contracts coordinated by `BotManager`. Perception reports structured observations through its own bus and contract, but does not decide or perform actions. `!mine` and `!craft` perform explicitly requested operations; they do not plan resource gathering.

## Foundation for Future Tasks

- [x] Navigation, inventory, mining, and simple crafting abilities are available through the Service API without simulating chat.
- [x] InputManager owns input sources; CommandManager owns parsing and handlers; ServiceManager owns Minecraft abilities.
- [x] Session-bound command contracts expose explicit operations; disposed service sessions cannot access a replacement bot.
- [x] Perception detectors publish structured observations through `ObservationBus`; their manager owns the console reporter and forwards observations to BotManager through PerceptionContract.
- [x] Console and Minecraft chat share the existing command registry; perception command results are reported in the local process console.

## LATER: Tasks and Planning

- [ ] TaskManager: start, cancel, return results, and handle task errors.
- [ ] Composite tasks that use existing services.
- [ ] Define action conflicts and interruption behavior for death/reconnect.
- [ ] ProductionPlanner and recipe dependencies.
- [ ] Autonomous resource gathering.
- [ ] Automatic tool and crafting table creation.
- [ ] Guard, patrol, and other autonomous scenarios.
- [ ] Persist and restore tasks if that proves necessary.

Do not duplicate Pathfinder Goals: `GoalFollow` already tracks a moving player. At this stage, `!goto` targets a static position, `!follow` uses a dynamic goal, and `!stop` cancels active operations without a TaskManager or an autonomous state machine.

Future automation can consume structured observations and request explicit capabilities through a dedicated contract provided by BotManager, following the current `contract.goto(x, y, z)` pattern. Managers must not import other subsystem managers or bypass their contracts. Decide its structure and state model in a later stage based on actual tasks; do not create empty modules in advance. Perception does not currently include computer vision, a world map, autonomous reactions, or a guarantee that Mineflayer exposes every sound.

See the [architecture TODO](architecturetodo.md) for current implementation and upcoming manual abilities.
