# Слой данных и SQLite

> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — `src/database/`: `database.ts`, `transaction.ts`, `bootstrap.ts`, `config.ts`, `migrations/` и `__tests__/sqliteTestDatabase.ts`; раздел о сущностях перенесён из My Lovely Car, `src/entities/` ещё нет
>
> **Пересмотр:** с первой сущностью в `src/entities/`; при изменении контракта репозиториев, мапперов, `database.ts`, очереди транзакций или runner'а миграций

Правила кода сущностей `src/entities/` и доступа к SQLite `src/database/`. Как слой устроен —
[`data-layer.md`](../architecture/data-layer.md), миграции —
[`migrations.md`](../workflows/migrations.md), почему схема строится только миграциями, а каждая
запись идёт через очередь транзакций, —
[ADR-0002](../adr/0002-schema-built-by-migrations-only-every-write-through-the-transaction-queue.md).

## Слой данных (entities)

Сущностей пока нет: правила раздела действуют с первой из них, имена в примерах — иллюстрация.

Каждая сущность лежит в `src/entities/<name>/` и состоит ровно из трёх файлов:
`<name>.types.ts`, `<name>.mapper.ts`, `<name>.repository.ts`.

**Типы (`*.types.ts`)** — для каждой сущности 4 типа. `*Row` — форма строки в БД (snake_case),
доменные типы — camelCase. `Audit` (`created_at`, `updated_at`) подмешивается из `../types`
(`src/entities/types.ts` переносится из My Lovely Car с первой сущностью).

```typescript
export interface NewOperationRow {
  account_id: number;
  note: string /* snake_case */;
}
export interface OperationRow extends NewOperationRow, Audit {
  id: number;
}
export type NewOperation = { accountId: number; note: string /* camelCase */ };
export type Operation = NewOperation & { id: number };
```

Если у сущности есть тип-дискриминатор с несовместимыми наборами полей (колонка `type`, от которой
зависит, какие поля заполнены), `New*` собирается из вариантов — по одному на значение
дискриминатора, — и невозможные комбинации не выражаются в типе. Читаемый тип при этом остаётся
плоским: строку из SQLite нельзя сузить до варианта без `as`, а потребители и так работают со всеми
типами сразу. Для производных типов нужен `DistributiveOmit` из `entities/types.ts` — обычный `Omit`
по union оставляет только общие поля.

**Маппер (`*.mapper.ts`)** — чистые функции конвертации между БД и доменом, без side effects.
`rowToX(row)` (snake_case → camelCase) и при необходимости `newXToRow(x)`.

**Репозиторий (`*.repository.ts`)**

- Единственное место с SQL. Использует `executeSql` / `querySql` / `runInTransaction` из
  `@/database`.
- Параметры запросов передаём массивом плейсхолдеров `?` (никогда не конкатенируем значения в SQL).
- SELECT-методы возвращают доменные типы через маппер: `(res ?? []).map(rowToOperation)`.
- Все мутации идут внутри `runInTransaction` (он вызывает `updateOnWeb` сам). Одиночная запись —
  тоже транзакция: соединение держит одну транзакцию, и запись мимо очереди, пришедшая посреди
  чужого сохранения, разрывает его.
- `insert*` возвращает `result.changes?.lastId`; если `id` нет — `throw new Error('Failed to get the ID of the new record')` (сообщения об ошибках — на английском).
- `update*` принимает `Partial<X>` и собирает `SET` через `buildUpdateAssignments` из
  `@/entities/update-builder` только из `!== undefined` полей; если изменений нет (`null`) —
  `return`. Модуль переносится из My Lovely Car (`src/entities/update-builder.ts`) с первым
  `update*` — без опции `localUpdatedAt` и `localUpdatedAtNow()`: они штампуют время для
  синхронизации.

```typescript
export async function getOperationsByAccountId(accountId: number): Promise<Operation[]> {
  const res = await querySql<OperationRow>(
    'SELECT * FROM operations WHERE account_id = ? ORDER BY created_at DESC',
    [accountId],
  );
  return (res ?? []).map(rowToOperation);
}
```

## Слой базы данных (SQLite)

Кроссплатформенный доступ: на вебе — `jeep-sqlite` поверх `sql.js`, нативно —
`@capacitor-community/sqlite`. Платформа определяется через `Capacitor.getPlatform()`.

**API (`database.ts`)**

- `initializeDatabase()` (инициализирует веб-стор и доводит схему миграциями) вызывает только
  `startDatabase()` из `src/services/startup`: и на первом старте в `main.ts` до `app.mount`, и по
  «Повторить» на экране ошибки (`DatabaseErrorScreen`).
- `executeSql(sql, values?, transaction?)` — для INSERT/UPDATE/DELETE/DDL. Внутри
  `runInTransaction` и шага миграции — всегда с `transaction = false`; флаг по умолчанию — только
  вне транзакций (таблица `schema_version` на старте), при открытой транзакции `executeSql` с ним
  бросает ошибку.
- `querySql<T>(sql, values?)` — для SELECT, возвращает `T[]`.
- `runInTransaction(work)` — мутация одной транзакцией: begin → `work` → commit, при ошибке
  rollback и rethrow, после коммита — `updateOnWeb`. Вызовы выстраиваются в очередь: транзакция,
  пришедшая во время другой, стартует после неё. Внутри `work` каждый `executeSql` получает
  `transaction = false`; вложенный вызов `runInTransaction` — взаимная блокировка (транзакция ждёт
  сама себя, в интеграционных тестах — таймаут), поэтому другой репозиторий из транзакции вызываем
  через его `*InTransaction`-функции. `beginTransaction` / `commitTransaction` /
  `rollbackTransaction` наружу не экспортируются: кроме очереди их получает только runner миграций.
- `updateOnWeb()` — на вебе сохраняет БД в стор (`saveToStore`). После транзакции его вызывает
  очередь; вручную — только после записей вне `runInTransaction`, то есть на старте, в `database.ts`
  (`prepareSchema` после миграций).
- Импорт всегда из barrel: `import { executeSql, querySql } from '@/database'`.

**Схема и миграции (`migrations/`)**

- Схему задают только шаги `MIGRATIONS` в `migrations/definitions.ts` (версии по возрастанию):
  каждая таблица, индекс, триггер и встроенная строка — шаг миграции. Полной формы схемы
  (`CREATE_SCHEMA`, seed) нет: новая установка проходит всю цепочку с версии 0, существующая база —
  шаги, которых ещё не видела.
- Единственная таблица вне миграций — `schema_version` с номером версии; её создаёт runner
  (`runMigrations`), а его вызывает `initializeDatabase()` через `prepareSchema()`.
- Шаг — одна транзакция: его операторы и новая версия в `schema_version` коммитятся вместе или не
  коммитятся вовсе, и шаг, прерванный посреди, следующий старт повторяет целиком. Операторы шага
  runner выполняет с `transaction = false`.
- При изменении схемы — новая миграция со следующим `version`: номера идут подряд с 1, без пропусков
  и повторов (держит `migrations/__tests__/runner.test.ts`). Шаги только дописываются: выпущенный
  шаг не правится, ошибку исправляет следующий — это держит снимок SQL
  (`migrations/__tests__/migrationSql.test.ts`, см. [`migrations.md`](../workflows/migrations.md)).
- Идемпотентных `ALTER TABLE ... ADD COLUMN` / `DROP COLUMN` и подготовки старых баз в runner'е нет:
  шаг атомарен и применяется один раз.
- Имена столбцов — snake_case; FK с явным `ON DELETE` — что происходит с операциями при удалении
  счёта или категории, решает модель данных (внешние ключи включены на каждом соединении:
  `database.ts` читает `PRAGMA foreign_keys` обратно и без них не стартует); ограничения через
  `CHECK`.
- Поля `created_at` / `updated_at` со значением `strftime(...)`; `updated_at` обновляется
  триггерами `*_update_updated_at` — они тоже создаются шагом миграции.
- Имя БД — константа `DB_NAME` из `config.ts`.

**Правила**

- Не выполнять SQL напрямую из компонентов/сторов — только через репозитории в `src/entities/`.
- Значения передавать параметрами `?`, не вставлять в строку запроса.
- `database/bootstrap.ts` — намеренное исключение из независимости database-слоя от Vue: этот
  application-facing модуль хранит реактивный статус инициализации, который нужен до создания Pinia
  и `app.mount`. Остальные database-модули не импортируют Vue.
