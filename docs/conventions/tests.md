# Тесты

> **Статус:** действует
>
> **Сверен:** 13 ноября 2026 — `test` в `vite.config.ts`, `playwright.config.ts`, `e2e/` (`app.spec.ts`, `accounts.spec.ts`, `operations.spec.ts`, `helpers.ts`), тесты в `src/**/__tests__/` (в том числе dom-тесты компонентов с заглушками `components/__tests__/testStubs.ts` и общие `src/__tests__/longPress.ts`, `deferred.ts`) и харнесс `database/__tests__/sqliteTestDatabase.ts`; порогов покрытия нет
>
> **Пересмотр:** при изменении конфигурации Vitest или Playwright, с первыми порогами покрытия, при изменении тестового харнесса SQLite, заглушек компонентов или помощников E2E

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
- Компонентные тесты — `@vue/test-utils` на happy-dom. Компонент монтируется сам, а тяжёлые
  компоненты PrimeVue подменяются заглушками из `src/components/__tests__/testStubs.ts`
  (`ButtonStub`, `DialogStub`, `DrawerStub`, `FloatLabelStub`, `InputTextStub`, `SelectButtonStub`):
  тест проверяет поведение своего компонента — события, доступные имена, классы положения, — а не
  разметку PrimeVue. Долгое нажатие в тесте — `holdElement` из `src/__tests__/longPress.ts` с
  фейковыми таймерами. Тест стора мокает репозиторий через `vi.hoisted` и `vi.mock`
  (`stores/__tests__/accountStore.test.ts`).
- Пороги покрытия задаём по модулям, а не общим процентом — см. комментарий в `vite.config.ts`. Их
  пока нет: порог появляется, когда у модуля есть база, которую стоит охранять; первыми —
  `database`, `entities` и `stores`.
- Тесты репозиториев и миграций идут на настоящем SQLite в памяти —
  `src/database/__tests__/sqliteTestDatabase.ts`: те же операторы и та же очередь транзакций, что в
  приложении, на сборке sql.js, которая уходит в веб (`public/assets/sql-wasm.wasm`). Тест
  репозитория мокает `@/database` функциями харнесса.
- E2E — Playwright (`npm run test:e2e`), прогон идёт на production-сборке (`webServer` в
  `playwright.config.ts`). База в вебе — IndexedDB контекста браузера, поэтому каждый тест начинает
  с пустой базы и готовит данные сам, через интерфейс, как человек.
- В E2E элементы ищем по ролям и доступным именам (`getByRole`) и по русским подписям полей
  (`getByLabel('Название*')`, обязательные — со `*`); `data-testid` не заводим. Общие помощники —
  `e2e/helpers.ts`: `addAccount` (счёт через вкладку «Счета» и его форму), `accountRow`, `longPress`,
  `createFinger`, `centerOf`.
- Долгое нажатие проверяем настоящим касанием, а не мышью: у пальца другая последовательность
  событий (браузер забирает жест на себя, а удержание без отменённого `touchend` заканчивается
  обычным тапом). Палец шлёт `createFinger` через CDP (`Input.dispatchTouchEvent`), а тест включает
  `test.use({ hasTouch: true, isMobile: true })`.
  `longPress` держит палец дольше задержки жеста и перед нажатием ждёт, пока над строкой нет тоста:
  тост стоит сверху списка около 3 с и принял бы касание на себя.
- Логика нативного кода без Android API (разбор строк, правила отбора) — JUnit-тесты в
  `android/app/src/test/java/my/lovely/finance/`, запуск — `./gradlew testDebugUnitTest` в
  `android/`, в CI — джоба `android`. Код, которому нужны Context, база или система, проверяет
  устройство ([`capture-device-checklist.md`](../testing/capture-device-checklist.md)).
