# Тесты

> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — `test` в `vite.config.ts`, `playwright.config.ts`, `e2e/app.spec.ts`, тесты в `src/**/__tests__/` и харнесс `database/__tests__/sqliteTestDatabase.ts`; порогов покрытия и dom-тестов ещё нет
>
> **Пересмотр:** при изменении конфигурации Vitest или Playwright, с первыми порогами покрытия, при изменении тестового харнесса SQLite

Правила unit- и E2E-тестов. Какие проверки гонять на каком шаге —
[`profiles.md`](../testing/profiles.md).

- Unit-тесты лежат в `__tests__/` рядом с модулем; окружение по умолчанию — `node`
  (`test.environment` в `vite.config.ts`), запуск — `npm test`, с покрытием — `npm run coverage`.
- Тесту, который монтирует компонент или трогает `document`, нужен docblock **первой строкой файла**:

```typescript
// @vitest-environment happy-dom
```

- Так и оставляем: `environmentMatchGlobs` в Vitest 4 удалён, а `projects` потребовал бы
  переименовывать каждый dom-тест в `*.dom.test.ts` ради того же результата — dom- и node-тесты
  одного модуля лежат в одном `__tests__/`. Забытый docblock падает сразу и громко
  (`document is not defined`), поэтому автоматизация тут ничего не ловит.
- Пороги покрытия задаём по модулям, а не общим процентом — см. комментарий в `vite.config.ts`. Их
  пока нет: порог появляется, когда у модуля есть база, которую стоит охранять; первыми —
  `database`, `entities` и `stores`.
- Тесты репозиториев и миграций идут на настоящем SQLite в памяти —
  `src/database/__tests__/sqliteTestDatabase.ts`: те же операторы и та же очередь транзакций, что в
  приложении, на сборке sql.js, которая уходит в веб (`public/assets/sql-wasm.wasm`). Тест
  репозитория мокает `@/database` функциями харнесса.
- E2E — Playwright (`npm run test:e2e`), прогон идёт на production-сборке (`webServer` в
  `playwright.config.ts`).
