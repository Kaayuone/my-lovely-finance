# Слой данных

> **Статус:** действует
>
> **Сверен:** 11 ноября 2026 — `src/database/` (`database.ts`, `transaction.ts`, `migrations/` с миграцией v1 в `definitions.ts`), `services/startup`, тестовый харнесс `sqliteTestDatabase.ts`; схема БД 1; очередь захвата `CaptureDatabase.java`
>
> **Пересмотр:** при изменении инициализации БД, раннера миграций или правил транзакций; когда очередь захвата начнут переносить в основную базу

Одна база SQLite `my_lovely_finance_db` (`src/database/config.ts`): на Android —
`@capacitor-community/sqlite`, в вебе — `jeep-sqlite` поверх `sql.js` с хранилищем в IndexedDB.
Решения — [ADR-0002](../adr/0002-schema-built-by-migrations-only-every-write-through-the-transaction-queue.md);
как добавить миграцию — [`workflows/migrations.md`](../workflows/migrations.md); правила кода
репозиториев — [`conventions/entities-and-sqlite.md`](../conventions/entities-and-sqlite.md).

## Модель

Таблиц предметной области пока нет. Есть только `schema_version` — одна строка с номером последнего
применённого шага миграции.

Вне этой базы — очередь захвата уведомлений `capture.db`: её пишет нативная служба, пока WebView нет,
схема живёт в Java, миграции приложения её не касаются
([ADR-0003](../adr/0003-captured-notifications-go-to-a-native-queue-the-app-takes-them-from.md),
[`notification-capture.md`](notification-capture.md)). Писатель основной базы остаётся один —
приложение.

## Где что лежит

| Слой | Файлы | Роль |
| ---- | ----- | ---- |
| Соединение | `src/database/database.ts` | `initializeDatabase`, `executeSql`, `querySql`, `runInTransaction`, сохранение веб-хранилища |
| Очередь транзакций | `src/database/transaction.ts` | порядок, откат, сохранение веб-хранилища после коммита |
| Миграции | `src/database/migrations/` | `MIGRATIONS` и раннер |
| Статус старта | `src/database/bootstrap.ts`, `src/services/startup/` | `dbInitStatus`, `startDatabase` |
| Тесты | `src/database/__tests__/sqliteTestDatabase.ts` | настоящий SQLite (sql.js) в памяти для тестов репозиториев и миграций |

## Инварианты

- **Внешние ключи включены на каждом соединении.** Прагма ставится и читается обратно; если она не
  включилась, старт падает с экраном ошибки. Без неё каждый `ON DELETE CASCADE` молча не работает.
- **Схема — только из миграций.** Новая установка проходит все шаги с версии 0. Шаг — одна
  транзакция вместе с номером версии: процесс, убитый посреди шага, оставляет базу на предыдущей
  версии, и следующий старт повторяет шаг.
- **Каждая запись — через `runInTransaction`**, внутри — `executeSql(sql, values, false)`. Без
  `false` адаптер оборачивает оператор в свою транзакцию: веб коммитит открытую после первого же
  оператора, Android бросает её с «Already in transaction». Поэтому `executeSql` без `false` при
  открытой транзакции бросает ошибку, а не пишет мимо.
- **Транзакции — очередь.** Пришедшая во время другой ждёт её конца; порядок — порядок прихода;
  упавшая не мешает следующей. Вложенный вызов ждёт сам себя вечно.
- **Веб-хранилище сохраняется только после коммита** (`updateOnWeb`): откаченная транзакция не
  попадает в IndexedDB.

## Опасные исключения

- Операторы старта — создание `schema_version` и её первая строка — идут с флагом по умолчанию, вне
  транзакций: до раннера транзакций ещё нет.
- `jeep-sqlite/loader` импортируется динамически: статический импорт затащил бы рантайм
  веб-компонента в стартовый чанк APK. По той же причине `bootstrap()` в `main.ts` не ждут через
  top-level `await` — в production-сборке это взаимная блокировка чанков.
- `checkConnectionsConsistency()` при старте закрывает соединения, о которых JS-сторона забыла после
  перезагрузки страницы; без него «Повторить» на экране ошибки повторяло бы ту же ошибку.
