# Валидация форм

> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — `package.json` и `src/`: `valibot` не установлен, `services/validation/` и форм ещё нет; роль `text-invalid` в `assets/main.css` есть
>
> **Пересмотр:** с первой формой, когда переносится `services/validation/`; при изменении `useFormValidation` или общих правил `services/validation/schemas.ts`

Правила формы описывает схема **valibot**, показывает ошибки composable `useFormValidation`
(`services/validation/`). Единый контракт для всех форм-фич.

Форм пока нет. С первой из них ставится `valibot` и переносятся из My Lovely Car:
`services/validation/` (`src/services/validation/`: `useFormValidation`, `schemas.ts`,
`formValidation.ts`, тип `FormErrors`), поля с `:error` — `InputTextField`
(`src/components/InputTextField.vue`), `InputNumberField` и `InputCurrencyValueField`
(`src/components/number-inputs/`) — и `FieldError` (`src/components/FieldError.vue`).

**Где что лежит**

- `features/<Feature>/validation.ts` — схемы фичи. Статичная схема — `UPPER_SNAKE_CASE`
  (`ACCOUNT_FORM_SCHEMA`), зависящая от контекста — функция (`getOperationFormSchema(type)`).
- `services/validation/schemas.ts` — общие правила: `requiredText`, `requiredNumber`,
  `requiredPositiveNumber`, `positiveNumber`, `requiredOption`, `requiredDate`, `notPastDate`,
  `notEarlierThan` (предикат — `isNotEarlierDay`), `optionValue`. Поле, которое должно быть больше
  нуля, — `requiredPositiveNumber`, если оно обязательное, и `positiveNumber`, если нет; «не раньше»
  сравнивает календарные дни, а не время.
- Тексты ошибок пишем **строкой прямо в правиле** (`requiredText('Введите название счёта')`), а не
  константой: сообщение читается рядом с правилом, которое его порождает.
- Схема описывает **только проверяемые поля** — остальные ключи формы valibot игнорирует.
- Правило, которое не принадлежит одному полю (`check` поверх `object`), попадает в `formError`;
  правило про соседнее поле — через `forward(check(...), ['field'])`.

**Когда показываются**

По сабмиту: до первой попытки сохранить форма молчит, после — поля переоцениваются на каждое
изменение, и исправленное поле сразу перестаёт быть красным. По blur не показываем: на телефоне
уход фокуса — частая случайность, и форма краснела бы во время заполнения.

**Как подключается**

- Диалог (родитель формы) вызывает `useFormValidation(schema, form)` и в `saveX()` идёт
  `if (!validate()) return;` — тоста о валидации нет, ошибки видны у полей.
- В watcher открытия диалога — `resetValidation()` рядом со сбросом формы.
- Ошибки уходят в подкомпонент формы пропом `errors: FormErrors` (ключи — пути valibot:
  `title`, `items.0.amount`), `formError` — отдельным пропом.

**Как показываются**

- `InputTextField`, `InputNumberField`, `InputCurrencyValueField` принимают `:error` — сами красят
  поле (`invalid` у PrimeVue) и рендерят сообщение.
- Поле без обёртки (`FloatLabel` + `Select`/`DatePicker`) — руками: `:invalid="Boolean(errors.x)"`
  и `<FieldError :message="errors.x" />` следом.
- Скролл к первому невалидному полю делает сам `validate()`: ищет первый `.p-invalid` в документе
  (форма на экране всегда одна), фокус ставит только в поле для ввода — не в дату (открылся бы
  календарь поверх сообщения) и не в readonly-триггер.
