# Pull Request: test: rewrite command tests to match chopTree/goto implementation

Target (base): fix/patch (fa4e1ff) ← Source: qwen-code-5d4cc8e9-e3f5-4d07-a7d2-869caffa3863 (d86a205)
Commits: d86a205 (1 commit, 1 file changed, +33/-18)

## Что сделано
- test/commands-and-reconnect.test.js переписан под текущую реализацию команд:
  - убран импорт и отдельный юнит-тест isChoppableLog (в коде такой функции нет и добавлять её не требовалось);
  - логика отбора блоков проверяется через inline-мок findBlock внутри теста chopTree;
  - ожидания приведены к реальному выводу: "Chopping tree: N blocks.";
  - прерванная рубка (!stop) логируется как обычный сбой — как в текущем коде;
  - добавлено покрытие goto по имени игрока.
- src/commands/chopTree.js — НЕ изменён (побайтово совпадает с HEAD).
- src/commands/goto.js — НЕ изменён в этом PR (правка error.name == "NoPath" уже в base fa4e1ff).

## Проверки
- npm test: 10 pass / 0 fail
- node --check на всех модулях: ок
- git status: чистый рабочий каталог
