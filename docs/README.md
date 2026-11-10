# Карта документации

> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — состав `docs/` и строки «Перед задачей» против документов каркаса 0.1.0 и захвата уведомлений
>
> **Пересмотр:** при добавлении, переносе или закрытии любого документа в `docs/`

Что прочитать перед задачей и где это лежит. Правила разработки — в [`AGENTS.md`](../AGENTS.md),
правила кода по слоям — в [`conventions/`](conventions/), задачи — в [`TODO.md`](../TODO.md), что
изменилось для пользователей — в [`CHANGELOG.md`](../CHANGELOG.md); этот файл отвечает только на
вопрос «какой документ мне сейчас нужен».

## Перед задачей

| Задача | Читать |
| --- | --- |
| Любая правка в приложении | [`AGENTS.md`](../AGENTS.md), [`project-context.md`](architecture/project-context.md) |
| Что строим и что не входит в MVP, монетизация, рынки | [`product/mvp.md`](product/mvp.md) |
| Захват уведомлений банков, разбор, шаблоны, политики Play | [`product/bank-notifications.md`](product/bank-notifications.md), [`architecture/notification-capture.md`](architecture/notification-capture.md) |
| Проверка захвата на телефоне | [`testing/capture-device-checklist.md`](testing/capture-device-checklist.md) |
| Схема БД, миграция, транзакции, репозиторий | [`data-layer.md`](architecture/data-layer.md), [`workflows/migrations.md`](workflows/migrations.md), [`conventions/entities-and-sqlite.md`](conventions/entities-and-sqlite.md) |
| Стор | [`conventions/stores.md`](conventions/stores.md) |
| `.vue`-компонент, вёрстка, тема | [`conventions/vue-components.md`](conventions/vue-components.md), [`conventions/styles-and-layout.md`](conventions/styles-and-layout.md) |
| Форма | [`conventions/form-validation.md`](conventions/form-validation.md) |
| Длинный список | [`conventions/virtual-scroller.md`](conventions/virtual-scroller.md) |
| Тесты, какие проверки гонять | [`conventions/tests.md`](conventions/tests.md), [`testing/profiles.md`](testing/profiles.md) |
| Android-манифест, Gradle, нативный плагин | [`project-context.md`](architecture/project-context.md#android-конфигурация) |
| Перенос модуля из My Lovely Car | [`project-context.md`](architecture/project-context.md#что-из-my-lovely-car-ещё-не-перенесено), [ADR-0001](adr/0001-stack-and-repository-layout-follow-my-lovely-car.md) |
| Правка документации | [`workflows/docs-update.md`](workflows/docs-update.md) |

## Каталоги

| Каталог | Что внутри | Поддерживается |
| --- | --- | --- |
| `architecture/` | Как система устроена сейчас | да |
| `conventions/` | Правила кода по слоям: сущности и SQLite, сторы, компоненты, вёрстка, формы, списки, тесты | да |
| `adr/` | Принятые решения и их причины | да, неизменяемы |
| `product/` | Продукт, объём MVP, требования к захвату уведомлений | да |
| `testing/` | Профили проверок | да |
| `workflows/` | Повторяемые процессы: миграции, обновление документации | да |
| `templates/` | Заготовки новых документов | да |

Каталоги `plans/active/`, `plans/completed/` и `archive/` заводятся, когда в них появится первый
документ ([`docs-update.md`](workflows/docs-update.md#жизненный-цикл-документа)).

## Статус-блок

Первым блоком после заголовка каждый документ несёт статус:

```markdown
> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — что именно сверено с кодом (приложение 0.1.0, схема БД 0)
>
> **Пересмотр:** событие, после которого документ обязан быть перечитан
```

| Поле | Значения и смысл |
| --- | --- |
| **Статус** | `действует` · `черновик` · `принято` (ADR) · `выполнен` (план) · `приостановлен` (план) · `заменён` · `архив` · `отклонено` |
| **Сверен** | Дата последней сверки и что именно сверялось — только последняя сверка, история в git |
| **Пересмотр** | Событие, после которого документ обязан быть перечитан. Обязательно для поддерживаемых документов |

У архивных документов вместо «Сверен» и «Пересмотр» стоит «Чем заменён»; у ADR — «Дата» и «Этап»
в собственном формате.

Состав блока, ссылки и дрейф версий проверяет `npm run check:docs`. Его запускают git-хуки
`pre-commit` и `pre-push`; CI документацию не проверяет.

## Новый документ

1. Взять заготовку из [`templates/`](templates/): [`architecture.md`](templates/architecture.md),
   [`plan.md`](templates/plan.md) или [`adr.md`](templates/adr.md).
2. Положить в каталог по смыслу из таблицы выше.
3. Добавить строку в таблицу «Перед задачей», если документ нужен перед каким-то классом задач.
4. Прогнать `npm run check:docs`.
