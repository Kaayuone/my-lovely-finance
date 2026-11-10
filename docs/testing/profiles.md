# Профили проверок

> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — `.githooks/`, скрипты `package.json`, `.github/workflows/ci.yml`, `vite.config.ts` и `playwright.config.ts`
>
> **Пересмотр:** при изменении `.githooks/`, скриптов в `package.json` или `.github/workflows/ci.yml`

Какой набор проверок достаточен на каком шаге. Профили разложены по git-хукам и джобам CI; этот
документ называет их и говорит, когда какой хватает.

## Профиль 1 — коммит

Хук [`.githooks/pre-commit`](../../.githooks/pre-commit):

```sh
npm run check:docs
npm run lint:ci
npm test
```

Ловит: битые ссылки и якоря, статус-блоки и дрейф версий в документации, нарушения правил ESLint
(включая правило про `as`), сломанные unit-тесты.
Не ловит: типы, форматирование, сборку, поведение в браузере.

Хуки подключает `npm install` (скрипт `prepare` ставит `core.hooksPath` на `.githooks`).

## Профиль 2 — push

Хук [`.githooks/pre-push`](../../.githooks/pre-push) добавляет проверку типов и повторяет проверку
документации: CI её не делает, а merge и rebase создают коммиты мимо `pre-commit`.

```sh
npm run check:docs
npm run type-check
```

`type-check` проверяет `src/`, E2E-тесты (`e2e/`) и конфиги корня (`vite.config.ts`,
`playwright.config.ts`, `capacitor.config.ts`, `eslint.config.ts`) — их проекты перечислены в
`tsconfig.json`.

Для правки, которая трогает схему БД, миграции или транзакции, гоните локально то же, что и CI:

```sh
npm run lint:ci && npm run format:check && npm run type-check && npm run coverage
```

`format:check` смотрит на `src/`, `e2e/`, `scripts/` и конфиги корня (`*.config.ts`, `env.d.ts`,
`tsconfig*.json`, `.prettierrc.json`). Документация, `package.json` и `package-lock.json` под
prettier не входят.

## Профиль 3 — CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), две независимые джобы на push и PR в
`main` и `dev`:

| Джоба     | Что доказывает                                                                     |
| --------- | ---------------------------------------------------------------------------------- |
| `checks`  | lint, format, типы, unit-тесты с покрытием, сборка, Playwright E2E на production-сборке |
| `android` | приложение собирается в debug APK, Gradle читает версию из `package.json`          |

Прогон на PR отменяется новым коммитом, прогон push в `dev` и `main` доходит до конца.
Документацию CI не проверяет: `check:docs` идёт только в хуках первых двух профилей.

Порогов покрытия пока нет: их ставят по модулям, когда у модуля появится база, которую стоит
охранять, — первыми те, где тихая регрессия стоит пользователю данных или денег (`database`,
`entities`, `stores`). Комментарий — в [`vite.config.ts`](../../vite.config.ts).

Локально E2E — `npm run test:e2e` (по production-сборке); отладочные варианты —
`npm run test:e2e:headed` и `npm run test:e2e:ui`. Браузер Playwright ставится отдельно:
`npx playwright install chromium`.

## Профиль 4 — устройство

Реальный Android перед релизом. Эмулятор не воспроизводит метрики шрифтов WebView, Doze, системный
бэкап и поведение оболочек производителей, которые убивают фоновые службы. Захват уведомлений
проверяется по [`capture-device-checklist.md`](capture-device-checklist.md) — после каждой правки
службы, доступа к уведомлениям или манифеста.

## Чего не доказывает ни один профиль

- Вёрстку на 320 / 360 / 400 px и планшет 600 / 800 px — только глаза в DevTools и
  `npm run dev:host` на телефоне.
- Захват уведомлений, живучесть слушателя, уведомления и бэкап — только устройство.
- Смысловую актуальность документации — `check:docs` ловит механику, смысл подтверждает автор
  изменения по [`docs-update.md`](../workflows/docs-update.md).
