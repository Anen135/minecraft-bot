# TODO — Automation (LATER)

TaskManager, Planner, and an autonomous agent are not implemented and are outside Stage 1. Users currently invoke abilities manually through `Command → Service → Mineflayer`. `!mine` and `!craft` perform explicitly requested operations; they do not plan resource gathering.

## Foundation for Future Tasks

- [x] Navigation, inventory, mining, and simple crafting abilities are available through the Service API without simulating chat.
- [x] Commands handle user input and routing; services contain Minecraft behavior.
- [x] Services receive the current `bot` instance; reconnect does not require a service container.

## LATER: Tasks and Planning

- [ ] TaskManager: start, cancel, return results, and handle task errors.
- [ ] Composite tasks that use existing services.
- [ ] Define action conflicts and interruption behavior for death/reconnect.
- [ ] ProductionPlanner and recipe dependencies.
- [ ] Autonomous resource gathering.
- [ ] Automatic tool and crafting table creation.
- [ ] Guard, patrol, and other autonomous scenarios.
- [ ] Persist and restore tasks if that proves necessary.

Do not duplicate Pathfinder Goals: `GoalFollow` already tracks a moving player. At this stage, `!goto` targets a static position, `!follow` uses a dynamic goal, and `!stop` cancels active operations without a new BehaviorManager.

Future automation should call services directly, for example `await NavigationService.goto(bot, x, y, z)`. Choose its structure and state model in a later stage based on actual tasks; do not create empty modules in advance.

See the [architecture TODO](architecturetodo.md) for current implementation and upcoming manual abilities.
