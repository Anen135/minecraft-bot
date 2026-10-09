# TODO — Архитектура расширяемого Mineflayer-проекта

## Цель

Построить расширяемую архитектуру Mineflayer-бота, в которой отдельно существуют:

- ядро приложения;
- обработчики событий;
- внутренняя шина событий;
- сервисы;
- плагины;
- команды;
- утилиты;
- длительные поведения;
- память;
- система прав;
- возможность масштабирования до нескольких ботов.

Главный принцип архитектуры:

```text
Minecraft
    ↓
Mineflayer
    ↓
Handlers
    ↓
EventBus
    ↓
Commands / Plugins / Behaviors
    ↓
Services
    ↓
Mineflayer API
```

---

# 1. Итоговая структура проекта

Организовать проект примерно так:

```text
src/
├─ index.js
├─ config.js
│
├─ core/
│  ├─ BotManager.js
│  ├─ EventBus.js
│  ├─ PluginManager.js
│  ├─ ServiceContainer.js
│  ├─ BehaviorManager.js
│  ├─ CommandLoader.js
│  ├─ CommandRegistry.js
│  └─ CommandManager.js
│
├─ handlers/
│  ├─ ChatHandler.js
│  ├─ DeathHandler.js
│  ├─ HealthHandler.js
│  ├─ EntityHurtHandler.js
│  ├─ KickedHandler.js
│  └─ ErrorHandler.js
│
├─ services/
│  ├─ NavigationService.js
│  ├─ InventoryService.js
│  ├─ PlayerService.js
│  ├─ ChatService.js
│  ├─ FoodService.js
│  └─ CombatService.js
│
├─ plugins/
│  ├─ SurvivalPlugin.js
│  ├─ CombatPlugin.js
│  └─ NavigationPlugin.js
│
├─ behaviors/
│  ├─ IdleBehavior.js
│  ├─ FollowBehavior.js
│  ├─ GuardBehavior.js
│  ├─ WanderBehavior.js
│  ├─ MineBehavior.js
│  └─ FleeBehavior.js
│
├─ commands/
│  ├─ help.js
│  ├─ follow.js
│  ├─ stop.js
│  ├─ goto.js
│  ├─ inventory.js
│  ├─ guard.js
│  └─ status.js
│
├─ memory/
│  ├─ MemoryStore.js
│  ├─ WaypointStore.js
│  └─ PlayerMemory.js
│
└─ utils/
   ├─ logger.js
   ├─ sleep.js
   ├─ math.js
   └─ format.js
```

---

# 2. BotManager

## Назначение

`BotManager` отвечает за жизненный цикл Mineflayer-бота.

Он должен:

- создавать экземпляр бота;
- подключать Mineflayer-плагины;
- запускать соединение;
- обрабатывать reconnect;
- корректно завершать работу.

Он не должен содержать:

- команды;
- игровую бизнес-логику;
- автономные решения;
- работу с инвентарём;
- обработку чата;
- combat-логику.

## TODO

- [ ] Реализовать создание Mineflayer-бота.
- [ ] Подключить `mineflayer-pathfinder`.
- [ ] Возвращать созданный экземпляр `bot`.
- [ ] Добавить reconnect.
- [ ] Добавить graceful shutdown.
- [ ] Не допускать повторной регистрации слушателей после reconnect.

---

# 3. EventBus

## Назначение

Создать внутреннюю шину событий приложения.

Mineflayer-события не должны распространяться напрямую по всему проекту.

Пример:

```text
Mineflayer: chat
↓
ChatHandler
↓
EventBus: chat:message
```

## TODO

- [ ] Создать `core/EventBus.js`.
- [ ] Использовать `EventEmitter`.
- [ ] Реализовать:
  - `emitEvent`
  - `onEvent`
  - `onceEvent`
  - при необходимости `offEvent`
- [ ] Использовать единый формат названий событий.

Пример:

```text
chat:message
bot:spawn
bot:death
bot:error
bot:kicked
bot:healthChanged
bot:lowHealth
player:joined
player:left
entity:hurt
entity:died
navigation:started
navigation:finished
navigation:failed
combat:started
combat:finished
```

---

# 4. Handlers

## Назначение

Handlers являются адаптерами между Mineflayer и EventBus.

Их задача:

```text
получить событие Mineflayer
↓
нормализовать данные
↓
отправить событие в EventBus
```

Handlers не должны принимать сложные игровые решения.

---

## 4.1 ChatHandler

- [ ] Обрабатывать Mineflayer `chat`.
- [ ] Игнорировать сообщения самого бота.
- [ ] Генерировать `chat:message`.
- [ ] Передавать:
  - username
  - message

---

## 4.2 DeathHandler

- [ ] Обрабатывать `death`.
- [ ] Генерировать `bot:death`.

---

## 4.3 HealthHandler

- [ ] Обрабатывать изменение здоровья и голода.
- [ ] Генерировать `bot:healthChanged`.
- [ ] Передавать:
  - health
  - food
  - saturation
- [ ] При необходимости генерировать дополнительные события:
  - `bot:lowHealth`
  - `bot:criticalHealth`

Handler не должен сам лечить или кормить бота.

---

## 4.4 EntityHurtHandler

- [ ] Обрабатывать получение урона сущностями.
- [ ] Определять пострадавшую сущность.
- [ ] Генерировать `entity:hurt`.
- [ ] При возможности передавать источник урона.

---

## 4.5 ErrorHandler

- [ ] Обрабатывать `error`.
- [ ] Логировать ошибку.
- [ ] Генерировать `bot:error`.

---

## 4.6 KickedHandler

- [ ] Обрабатывать `kicked`.
- [ ] Передавать причину отключения.
- [ ] Генерировать `bot:kicked`.

---

# 5. ServiceContainer

## Назначение

Хранить сервисы приложения и предоставлять единый способ доступа к ним.

## TODO

- [ ] Реализовать `register(name, service)`.
- [ ] Реализовать `get(name)`.
- [ ] Реализовать `has(name)`.
- [ ] Выбрасывать понятную ошибку при запросе отсутствующего сервиса.
- [ ] Не использовать глобальные singleton-переменные там, где можно передавать container явно.

---

# 6. Services

## Принцип

Service отвечает на вопрос:

> Что бот умеет делать?

Сервисы содержат конкретные действия и операции.

---

# 7. NavigationService

## Назначение

Инкапсулировать всю основную работу с `mineflayer-pathfinder`.

## TODO

- [ ] `goto(x, y, z)`
- [ ] `gotoNear(x, y, z, radius)`
- [ ] `follow(entity, distance)`
- [ ] `stop()`
- [ ] `isMoving()`
- [ ] `getCurrentGoal()`
- [ ] поддержка waypoint-навигации
- [ ] генерация событий:
  - `navigation:started`
  - `navigation:finished`
  - `navigation:failed`

---

# 8. PlayerService

## TODO

- [ ] `getPlayer(username)`
- [ ] `getEntity(username)`
- [ ] `isVisible(username)`
- [ ] `getNearestPlayer()`
- [ ] `distanceTo(username)`
- [ ] `getPlayersInRadius(radius)`
- [ ] безопасная работа с отсутствующими игроками

Команды и плагины не должны напрямую дублировать работу с `bot.players`, если это можно вынести сюда.

---

# 9. InventoryService

## TODO

- [ ] `getItems()`
- [ ] `findItem(name)`
- [ ] `hasItem(name)`
- [ ] `countItem(name)`
- [ ] `equip(name)`
- [ ] `unequip()`
- [ ] `getHeldItem()`
- [ ] поиск лучшего оружия
- [ ] поиск лучшей брони
- [ ] работа с контейнерами
- [ ] сортировка предметов

---

# 10. ChatService

## TODO

- [ ] `say(message)`
- [ ] `whisper(username, message)`
- [ ] ограничение длины сообщений
- [ ] разбиение длинных сообщений
- [ ] cooldown
- [ ] защита от спама
- [ ] очередь сообщений при необходимости

---

# 11. FoodService

## TODO

- [ ] поиск доступной еды
- [ ] определение лучшей еды
- [ ] `canEat()`
- [ ] `eat(item)`
- [ ] `eatBestFood()`
- [ ] учитывать hunger и saturation

---

# 12. CombatService

## Назначение

CombatService отвечает за механику боя.

Он отвечает на вопрос:

> Как драться?

## TODO

- [ ] `attack(entity)`
- [ ] `stopAttack()`
- [ ] `selectWeapon()`
- [ ] `findThreat()`
- [ ] `fleeFrom(entity)`
- [ ] проверка дистанции
- [ ] смена оружия
- [ ] контроль cooldown атак
- [ ] базовая оценка опасности

---

# 13. PluginManager

## Назначение

Управлять регистрацией и жизненным циклом плагинов.

## TODO

- [ ] `register(plugin)`
- [ ] `load()`
- [ ] `unload()`
- [ ] поддержать lifecycle:
  - `register`
  - `start`
  - `stop`
- [ ] логировать ошибки загрузки плагинов

---

# 14. Plugins

## Принцип

Plugin отвечает на вопрос:

> Когда и почему нужно выполнить действие?

Пример:

```text
Service:
бот умеет есть

Plugin:
если бот голоден — нужно поесть
```

---

# 15. SurvivalPlugin

## TODO

- [ ] слушать `bot:healthChanged`
- [ ] реагировать на низкое здоровье
- [ ] реагировать на голод
- [ ] использовать `FoodService`
- [ ] использовать `NavigationService` при необходимости бегства
- [ ] не обращаться напрямую к inventory, если есть соответствующий сервис
- [ ] не хранить всю логику движения внутри плагина

---

# 16. CombatPlugin

## TODO

- [ ] слушать `entity:hurt`
- [ ] определять, когда бот должен ответить атакой
- [ ] использовать `CombatService`
- [ ] учитывать здоровье
- [ ] учитывать настройки дружелюбных игроков
- [ ] не атаковать владельца или trusted-игроков
- [ ] поддержать режимы:
  - passive
  - defensive
  - aggressive

---

# 17. NavigationPlugin

## Возможные задачи

- [ ] реакция на застревание
- [ ] повтор маршрута
- [ ] восстановление pathfinding
- [ ] возврат к waypoint
- [ ] контроль ошибок навигации

---

# 18. CommandManager

## Назначение

Принимать события `chat:message`, распознавать команды и запускать их.

CommandManager не должен напрямую подписываться на Mineflayer `chat`.

## TODO

- [ ] слушать `chat:message` через EventBus
- [ ] распознавать prefix
- [ ] извлекать имя команды
- [ ] извлекать аргументы
- [ ] получать команду через CommandRegistry
- [ ] проверять permission
- [ ] передавать в команду:
  - username
  - args
  - services
  - eventBus
  - при необходимости context
- [ ] перехватывать ошибки выполнения
- [ ] логировать команды

---

# 19. CommandLoader

## TODO

- [ ] автоматически загружать команды из директории
- [ ] поддерживать ES modules
- [ ] валидировать структуру команды
- [ ] выдавать понятную ошибку при неправильном формате
- [ ] не загружать посторонние файлы

---

# 20. CommandRegistry

## TODO

- [ ] регистрировать команды
- [ ] получать команду по имени
- [ ] поддерживать aliases
- [ ] проверять дубликаты
- [ ] выдавать список команд
- [ ] фильтровать команды по permission

---

# 21. Команды

## Принцип

Команда отвечает на вопрос:

> Что пользователь попросил сделать?

Команда не должна содержать сложную механику.

Плохо:

```text
follow.js
→ напрямую управляет pathfinder
→ ищет игрока
→ обрабатывает ошибки
→ переключает состояния
```

Хорошо:

```text
follow.js
→ PlayerService
→ NavigationService
```

## Базовые команды

- [ ] `help`
- [ ] `follow`
- [ ] `stop`
- [ ] `goto`
- [ ] `inventory`
- [ ] `come`
- [ ] `where`
- [ ] `say`
- [ ] `look`
- [ ] `status`
- [ ] `guard`

---

# 22. BehaviorManager

## Назначение

Управлять длительными состояниями бота.

Plugin реагирует на события.

Behavior выполняется длительное время.

Примеры:

```text
FOLLOWING
GUARDING
MINING
FIGHTING
FLEEING
WANDERING
IDLE
```

## TODO

- [ ] хранить текущее behavior
- [ ] `startBehavior()`
- [ ] `stopBehavior()`
- [ ] переключение между behaviors
- [ ] lifecycle:
  - `start`
  - `tick`
  - `stop`
- [ ] не запускать конфликтующие behaviors одновременно
- [ ] поддержать приоритеты
- [ ] поддержать принудительное прерывание

---

# 23. IdleBehavior

- [ ] состояние по умолчанию
- [ ] не выполнять лишних действий
- [ ] быть безопасной точкой возврата после остановки других behaviors

---

# 24. FollowBehavior

## TODO

- [ ] принимать target player
- [ ] поддерживать дистанцию
- [ ] восстанавливать follow при временной потере пути
- [ ] завершаться при команде stop
- [ ] обрабатывать исчезновение игрока

---

# 25. GuardBehavior

## TODO

- [ ] принимать точку охраны
- [ ] принимать радиус
- [ ] возвращаться в область охраны
- [ ] обнаруживать угрозы
- [ ] использовать CombatService
- [ ] возвращаться на пост после боя

---

# 26. WanderBehavior

## TODO

- [ ] выбирать случайные точки
- [ ] ограничивать радиус
- [ ] избегать опасных зон
- [ ] корректно останавливаться

---

# 27. MineBehavior

## TODO

- [ ] принимать тип ресурса
- [ ] искать ближайший подходящий блок
- [ ] строить маршрут
- [ ] добывать блок
- [ ] повторять цикл
- [ ] прекращать работу при заполненном инвентаре

---

# 28. FleeBehavior

## TODO

- [ ] принимать угрозу
- [ ] выбирать безопасное направление
- [ ] использовать NavigationService
- [ ] учитывать здоровье
- [ ] завершаться после достижения безопасной дистанции

---

# 29. Memory

## Назначение

Создать систему краткосрочной и сохраняемой памяти.

## Хранить

- [ ] home position
- [ ] waypoints
- [ ] известных игроков
- [ ] owner
- [ ] trusted players
- [ ] последнюю позицию
- [ ] последний источник урона
- [ ] последнее активное behavior
- [ ] пользовательские настройки

---

# 30. MemoryStore

## TODO

- [ ] `get(key)`
- [ ] `set(key, value)`
- [ ] `delete(key)`
- [ ] `has(key)`
- [ ] `save()`
- [ ] `load()`
- [ ] хранение JSON
- [ ] защита от повреждённого файла

---

# 31. WaypointStore

## TODO

- [ ] создавать waypoint
- [ ] удалять waypoint
- [ ] получать waypoint по имени
- [ ] выводить список waypoint
- [ ] хранить:
  - name
  - x
  - y
  - z
  - dimension

---

# 32. Permissions

## Роли

```text
owner
admin
trusted
guest
```

## TODO

- [ ] назначить permission каждой команде
- [ ] проверять permission в CommandManager
- [ ] хранить trusted users
- [ ] owner должен иметь полный доступ
- [ ] guest должен иметь ограниченный набор команд

Пример структуры команды:

```js
{
    name: 'stop',
    permission: 'trusted'
}
```

---

# 33. Logger

## TODO

Создать единый интерфейс:

```text
logger.info()
logger.warn()
logger.error()
logger.debug()
```

Не использовать повсеместно прямые `console.log`.

Позже должна быть возможность заменить реализацию на:

```text
pino
winston
другой logger
```

без изменения остального проекта.

---

# 34. Utils

Utils должны быть:

- независимыми;
- stateless;
- не привязанными к Mineflayer.

Примеры:

```text
sleep()
clamp()
distance()
randomInt()
formatDuration()
```

Не переносить в utils:

```text
gotoPlayer()
attackEntity()
eatFood()
```

Это сервисы.

---

# 35. Composition Root

`index.js` должен быть местом сборки приложения.

Он должен:

```text
создать BotManager
создать bot
создать EventBus
создать services
создать handlers
создать commands
создать plugins
создать BehaviorManager
связать зависимости
запустить приложение
```

`index.js` не должен содержать игровую бизнес-логику.

---

# 36. Направление зависимостей

Соблюдать:

```text
Commands
    ↓
Services

Plugins
    ↓
Services

Behaviors
    ↓
Services

Handlers
    ↓
EventBus

Services
    ↓
Mineflayer
```

Избегать:

```text
Command
↓
Plugin
↓
Handler
↓
Command
```

Не создавать циклические зависимости.

---

# 37. Правила ответственности

## Handler

Получает Mineflayer-событие.

## EventBus

Передаёт внутреннее событие.

## Command

Принимает пользовательский запрос.

## Plugin

Решает, когда автоматически выполнить действие.

## Behavior

Управляет длительным состоянием.

## Service

Выполняет конкретное действие.

## Utils

Содержат универсальные вспомогательные функции.

---

# 38. Пример потока команды

```text
Игрок:
!follow Roman

↓

Mineflayer chat

↓

ChatHandler

↓

chat:message

↓

CommandManager

↓

CommandRegistry

↓

follow command

↓

PlayerService

↓

NavigationService

↓

mineflayer-pathfinder
```

---

# 39. Пример автономного поведения

```text
Mineflayer health

↓

HealthHandler

↓

bot:healthChanged

↓

SurvivalPlugin

↓

FoodService.eatBestFood()

↓

Mineflayer
```

---

# 40. Пример combat-потока

```text
Mineflayer entityHurt

↓

EntityHurtHandler

↓

entity:hurt

↓

CombatPlugin

↓

CombatService

↓

BehaviorManager

↓

Fight / Flee
```

---

# 41. Reconnect

## TODO

- [ ] автоматически переподключаться после разрыва
- [ ] использовать задержку
- [ ] ограничить частоту reconnect
- [ ] корректно обрабатывать spawn после reconnect
- [ ] не создавать повторные listeners
- [ ] восстанавливать критичные runtime-системы
- [ ] при необходимости восстанавливать behavior

---

# 42. Graceful Shutdown

## TODO

При завершении процесса:

- [ ] остановить active behavior
- [ ] сохранить memory
- [ ] остановить плагины
- [ ] закрыть соединение
- [ ] завершить процесс без повреждения данных

---

# 43. Multi-bot readiness

Архитектура должна позволять позже запускать несколько ботов.

Пример:

```text
BotManager
├─ WorkerBot
├─ GuardBot
├─ ScoutBot
└─ BuilderBot
```

## TODO

- [ ] избегать глобального состояния
- [ ] не привязывать EventBus к глобальному singleton
- [ ] сервисы должны относиться к конкретному боту
- [ ] memory должна уметь разделяться по bot id
- [ ] конфигурация должна поддерживать несколько профилей

---

# 44. Будущие сервисы

Подготовить архитектуру для будущих модулей:

- [ ] CraftingService
- [ ] StorageService
- [ ] MiningService
- [ ] BuildingService
- [ ] FarmingService
- [ ] WorldService
- [ ] EntityService
- [ ] EquipmentService

---

# 45. Будущие плагины

Возможные расширения:

- [ ] AutoEatPlugin
- [ ] AutoArmorPlugin
- [ ] GuardPlugin
- [ ] AutoSleepPlugin
- [ ] ThreatDetectionPlugin
- [ ] AntiStuckPlugin
- [ ] AutoReconnectPlugin

---

# 46. Будущие интерфейсы управления

Архитектура должна позволять подключить:

- [ ] Web UI
- [ ] REST API
- [ ] WebSocket API
- [ ] CLI
- [ ] Discord bot
- [ ] LLM-интерфейс

Команды из разных интерфейсов должны по возможности использовать те же сервисы и behaviors.

---

# 47. Главное архитектурное правило

Не создавать декоративные классы без реальной ответственности.

Каждый слой должен иметь конкретную функцию:

```text
Handler
    получает событие

EventBus
    передаёт событие

Plugin
    принимает автоматическое решение

Command
    принимает пользовательский запрос

Behavior
    ведёт длительный процесс

Service
    выполняет действие
```

---

# 48. Definition of Done — базовая архитектура

Базовый архитектурный этап считается завершённым, когда:

- [ ] BotManager отвечает только за жизненный цикл бота.
- [ ] EventBus работает.
- [ ] Handlers переводят Mineflayer-события в события приложения.
- [ ] CommandManager работает через EventBus.
- [ ] CommandLoader и CommandRegistry работают независимо.
- [ ] ServiceContainer работает.
- [ ] NavigationService работает.
- [ ] PlayerService работает.
- [ ] InventoryService работает.
- [ ] ChatService работает.
- [ ] FoodService работает.
- [ ] PluginManager работает.
- [ ] SurvivalPlugin использует сервисы.
- [ ] BehaviorManager поддерживает хотя бы одно длительное поведение.
- [ ] permissions работают.
- [ ] memory сохраняется.
- [ ] reconnect работает.
- [ ] logger используется вместо хаотичных `console.log`.
- [ ] команды не содержат сложную Mineflayer-логику.
- [ ] handlers не содержат бизнес-логику.
- [ ] utils не содержат Mineflayer-зависимую логику.
- [ ] `index.js` используется как Composition Root.
- [ ] отсутствуют циклические зависимости между слоями.

---

# 49. Следующие этапы развития

После базовой архитектуры можно добавлять:

```text
Combat
Mining
Crafting
Guard
Farming
Storage
Building
Exploration
Web UI
REST API
WebSocket API
LLM control
Multi-bot coordination
```

без необходимости переписывать фундамент проекта.