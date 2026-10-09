# TODO — Mineflayer Bot Architecture

## Цель

Перейти от набора разрозненных команд к расширяемой архитектуре бота, где команды создают задачи, задачи управляют состояниями, а состояния используют готовые возможности Mineflayer и `mineflayer-pathfinder`.

Основная идея:

```text
Commands
    ↓
Tasks
    ↓
States
    ↓
Goals / Actions
    ↓
Mineflayer
```

---

## 1. Не дублировать готовые behaviour-механики Pathfinder

Некоторые команды уже фактически являются полноценными долговременными behaviours.

Например:

```js
bot.pathfinder.setGoal(
    new GoalFollow(player.entity, 2),
    true
)
```

`GoalFollow` с `dynamic = true` уже реализует постоянное преследование движущейся сущности:

- игрок перемещается;
- Pathfinder пересчитывает маршрут;
- бот продолжает следовать;
- игрок останавливается — бот остаётся рядом;
- игрок снова идёт — бот продолжает движение.

Поэтому отдельный `FollowBehavior`, который просто повторяет эту механику, не нужен.

---

## 2. Добавить BehaviorManager / StateManager

Нужен слой, который будет знать, чем бот занимается сейчас, и предотвращать конфликты между действиями.

Пример состояний:

```text
idle
follow
stay
guard
patrol
mine
collect
attack
flee
returnHome
```

Пример переходов:

```text
IDLE
  ↓ !follow
FOLLOW
  ↓ !guard
GUARD
  ↓ !mine iron
MINING
  ↓ задача завершена
IDLE
```

BehaviorManager должен:

- хранить текущее состояние;
- хранить данные текущего состояния;
- корректно останавливать предыдущее действие;
- очищать Pathfinder goal;
- очищать control states;
- позволять безопасно переключать behaviour.

Черновой интерфейс:

```js
behaviorManager.set('follow', {
    target: username
})

behaviorManager.stop()

behaviorManager.current
behaviorManager.data
```

---

## 3. Разделить одноразовые команды и долговременные behaviours

### Одноразовая команда

```text
!come
```

Означает:

> Иди к координатам, где игрок находится сейчас.

Можно использовать:

```js
new GoalNear(x, y, z, 1)
```

Цель статическая.

### Behaviour

```text
!follow
```

Означает:

> Постоянно следуй за игроком.

Используется:

```js
new GoalFollow(player.entity, 2)
```

с динамической целью.

---

## 4. Использовать готовые Goals Pathfinder

Не реализовывать вручную то, что уже есть в `mineflayer-pathfinder`.

Полезные goals:

```text
GoalBlock
GoalNear
GoalXZ
GoalNearXZ
GoalY
GoalGetToBlock
GoalLookAtBlock
GoalBreakBlock
GoalCompositeAny
GoalCompositeAll
GoalInvert
GoalFollow
GoalPlaceBlock
```

Примеры:

```text
follow
    → GoalFollow

come
    → GoalNear

goto
    → GoalBlock

patrol
    → GoalBlock(A)
    → GoalBlock(B)
    → GoalBlock(C)
    → repeat

guard
    → GoalNear(home)
    → обнаружение противника
    → combat
    → возврат к home

mine
    → найти block
    → GoalGetToBlock
    → dig()
    → collect
```

---

## 5. Добавить систему Tasks

Следующий уровень архитектуры — команды не должны напрямую выполнять всю логику.

Например:

```text
!mine iron 32
```

должна создавать задачу:

```js
{
    type: 'mine',
    block: 'iron_ore',
    amount: 32
}
```

Дальше TaskManager самостоятельно ведёт её выполнение.

Пример внутреннего workflow:

```text
SEARCH
  ↓
MOVE_TO_BLOCK
  ↓
DIG
  ↓
COLLECT
  ↓
CHECK_AMOUNT
  ↓
SEARCH
  ↓
...
  ↓
DONE
```

---

## 6. Добавить TaskManager

Ответственность:

- запуск новой задачи;
- отмена старой задачи;
- хранение текущей задачи;
- обработка этапов;
- отслеживание завершения;
- обработка ошибок;
- переход к следующему state;
- возврат в `idle`.

Возможный интерфейс:

```js
taskManager.start({
    type: 'mine',
    block: 'iron_ore',
    amount: 32
})

taskManager.cancel()

taskManager.currentTask
taskManager.currentStep
```

---

## 7. Планируемая архитектура

```text
Minecraft Server
       │
       ▼
Mineflayer
       │
       ▼
Bot Core
       │
       ├── CommandManager
       │
       ├── TaskManager
       │
       ├── BehaviorManager
       │
       ├── EventBus
       │
       ├── Memory
       │
       └── Services
               │
               ├── navigation
               ├── combat
               ├── inventory
               ├── mining
               ├── storage
               └── world
```

---

## 8. Предлагаемая структура проекта

```text
src/
├─ index.js
│
├─ core/
│  ├─ BotManager.js
│  ├─ CommandManager.js
│  ├─ TaskManager.js
│  ├─ BehaviorManager.js
│  └─ EventBus.js
│
├─ commands/
│  ├─ follow.js
│  ├─ come.js
│  ├─ stop.js
│  ├─ goto.js
│  ├─ guard.js
│  ├─ patrol.js
│  └─ mine.js
│
├─ tasks/
│  ├─ MineTask.js
│  ├─ GuardTask.js
│  ├─ PatrolTask.js
│  └─ CollectTask.js
│
├─ services/
│  ├─ NavigationService.js
│  ├─ CombatService.js
│  ├─ InventoryService.js
│  ├─ MiningService.js
│  └─ WorldService.js
│
├─ memory/
│  ├─ Memory.js
│  └─ WaypointStore.js
│
└─ utils/
   └─ logger.js
```

---

## 9. Ближайшие задачи

- [ ] Создать `BehaviorManager`
- [ ] Добавить состояния `idle`, `follow`, `stay`
- [ ] Перевести `follow` на управление через `BehaviorManager`
- [ ] Сделать корректный `stop`
- [ ] Разделить `come` и `follow`
- [ ] Создать `TaskManager`
- [ ] Добавить структуру `Task`
- [ ] Реализовать первую составную задачу `mine`
- [ ] Добавить этапы `SEARCH → MOVE → DIG → COLLECT`
- [ ] Сделать отмену текущей задачи
- [ ] Добавить обработку смерти бота
- [ ] Добавить восстановление после respawn
- [ ] Добавить автоматический reconnect
- [ ] Добавить владельца и whitelist команд
- [ ] Добавить `guard`
- [ ] Добавить `patrol`
- [ ] Добавить waypoint-систему
- [ ] Добавить память `homePosition`
- [ ] Добавить логирование переходов состояний

---

## 10. Долгосрочная цель

Получить не набор команд вида:

```text
!follow
!goto
!mine
```

а полноценного Minecraft-агента, которому можно назначать задачи:

```text
!guard home
!patrol base
!mine iron 32
!collect oak_log 64
!follow Roman
```

а бот самостоятельно управляет:

```text
задачей
→ текущим состоянием
→ навигацией
→ действиями
→ обработкой ошибок
→ завершением
```

Главный принцип:

> Команды описывают намерение пользователя.  
> TaskManager управляет задачей.  
> BehaviorManager управляет текущим состоянием.  
> Mineflayer и Pathfinder выполняют низкоуровневые действия.
