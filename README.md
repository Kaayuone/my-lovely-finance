# my-lovely-finance

Personal finance tracker: card spending recorded from bank notifications, cash in two taps.

Local-first Android-приложение для учёта личных финансов: Vue 3 + Capacitor + SQLite. Траты по
карте записываются сами из уведомлений банка, наличные — вручную; данные остаются на телефоне.
В версии 0.1.0 готовы захват уведомлений с разбором в черновики, модель данных (схема БД 2) и
ручной учёт — экраны «Счета» и «Операции»; «Входящих», где черновик станет операцией, ещё нет.

Правила разработки — [`AGENTS.md`](AGENTS.md), карта документации — [`docs/README.md`](docs/README.md),
продукт и MVP — [`docs/product/mvp.md`](docs/product/mvp.md), задачи — [`TODO.md`](TODO.md).

## Структура

```text
src/       приложение: Vue 3, Pinia, SQLite, сервисы Capacitor
android/   нативный проект Capacitor, свои плагины — android/app/src/main/java/my/lovely/finance/
e2e/       Playwright по production-сборке
public/    статические файлы веб-сборки
docs/      документация; что читать перед задачей — docs/README.md
scripts/   проверки репозитория (check:docs)
```

## Команды (из корня)

| Команда                | Что делает                                                     |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | dev-сервер приложения                                          |
| `npm run dev:host`     | то же, доступно по сети (для проверки на реальном Android)     |
| `npm run build`        | проверка типов и сборка                                        |
| `npm run lint:ci`      | eslint по всему репозиторию                                    |
| `npm run format:check` | prettier по `src/`, E2E, скриптам и конфигам корня             |
| `npm run type-check`   | проверка типов: `src/`, E2E, конфиги корня                     |
| `npm test`             | unit-тесты                                                     |
| `npm run coverage`     | то же с отчётом покрытия                                       |
| `npm run test:e2e`     | Playwright по production-сборке приложения                     |
| `npm run check:docs`   | документация: ссылки, статус-блоки, дрейф версий               |

Перед push — те же проверки, что и в CI: `npm run lint:ci`, `npm run format:check`,
`npm run type-check`, `npm test`. Git-хуки из `.githooks/` подключает `npm install`.

Для E2E нужен браузер Playwright: `npx playwright install chromium`.

Сборка APK: `npm run build`, `npx cap sync android`, затем `./gradlew assembleDebug` в `android/`.
Версия приложения живёт только в `package.json`; `android/app/build.gradle` читает её оттуда и сам
считает `versionCode`.
