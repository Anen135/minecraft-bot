# TODO — Core abilities, этап 1

Текущий этап: ручное управление способностями бота. Этот план заменяет прежний проект расширенной архитектуры: ServiceContainer, handlers, новый Command API и State Machine сейчас не нужны.

```text
User → Command → Service → Mineflayer
```

Команды отвечают за parsing, validation, routing и output. Сервисы реализуют способности и обрабатывают ошибки Minecraft, не зная синтаксиса чат-команд. Они получают актуальный bot в каждом вызове, в том числе после reconnect.

## Реализовано

- [x] Сохранена структура commands/, services/, core/, plugins/, behaviors/, utils/.
- [x] CommandLoader загружает и проверяет ESM-команды; CommandRegistry проверяет дубликаты.
- [x] CommandManager разбирает префикс и передаёт { bot, username, args }, изолирует ошибки команд.
- [x] BotManager создаёт бота, подключает pathfinder/collectblock и переподключается с ограниченной растущей задержкой.
- [x] NavigationService.goto(bot, x, y, z), follow(bot, username), stop(bot).
- [x] Сохранены !goto, !goto <player>, !goto <x> <y> <z> и !follow [player].
- [x] !stop останавливает сбор блоков, навигацию и control states.
- [x] InventoryService.list(bot), equip(bot, itemName, destination); !inventory, !equip.
- [x] MiningService.chopTree(bot), mine(bot, blockName, count); !chop, !mine.
- [x] CraftingService.craft(bot, itemName, count); !craft из имеющихся ресурсов, без recursive crafting.
- [x] Unit tests с моками для Service API, маршрутизации и ошибок, без Minecraft-сервера.
- [x] README описывает фактическое ручное управление и границы реализации.

## Следующие ручные возможности

- [ ] Расширить набор core services по реальной функциональности.
- [ ] Добавить ручной smelting.
- [ ] Добавить ручной building/place API.
- [ ] Добавить combat API.
- [ ] Добавить еду, сон, farming и работу с контейнерами.
- [ ] Добиться покрытия всех survival core abilities командами.
- [ ] Добавить waypoint/home команды поверх существующего MemoryService.
- [ ] Добавить права доступа/whitelist; OWNER_NAME пока не проверяется.
- [ ] Добавить полноценное завершение процесса с отменой действий и сохранением памяти.
- [ ] Проверить поведение на живом Minecraft-сервере.

## LATER

- [ ] TaskManager и composite tasks.
- [ ] ProductionPlanner и recipe dependency graph.
- [ ] Autonomous resource acquisition и автоматическое создание инструментов/верстака.
- [ ] Автономные guard/patrol/survival поведения.
- [ ] Персистентная память и восстановление действий после respawn/reconnect.
- [ ] Дополнительные интерфейсы управления и координация нескольких ботов.

Автоматизация будет вызывать тот же Service API. Заготовки EventBus, BehaviorManager и plugins сохранены, но не являются обязательным слоем текущих команд. Подробнее: [будущие задачи](taskmanager.md).

- [ ] Устранить ограничения отмены collectblock во время экипировки и ожидания подбора предмета без изменения пользовательского интерфейса.
