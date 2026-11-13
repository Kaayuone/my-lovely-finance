# Валидация форм

> **Статус:** действует
>
> **Сверен:** 13 ноября 2026 — `package.json` (`valibot`), `services/validation/` (`schemas.ts`, `amountSchemas.ts`, `useFormValidation`, `formValidation`), `features/AddAccountDialog/validation.ts`, `features/AddOperationDialog/validation.ts`, поля `InputTextField`, `TextareaField`, `InputAmountField`, `CurrencySelect`, `FieldError`, `utils/money.ts`; роль `text-invalid` в `assets/main.css`
>
> **Пересмотр:** при изменении `useFormValidation`, общих правил `services/validation/schemas.ts` и `amountSchemas.ts` или `InputAmountField`

Правила формы описывает схема **valibot**, показывает ошибки composable `useFormValidation`
(`services/validation/`). Единый контракт для всех форм-фич; сейчас их две —
`features/AddAccountDialog` и `features/AddOperationDialog`.

Из My Lovely Car перенесены `services/validation/` (`useFormValidation`, `schemas.ts`,
`formValidation.ts`, тип `FormErrors`) и поля с `:error` — `InputTextField`, `TextareaField` и
`FieldError`. Числовые поля MLC (`InputNumberField`, `InputCurrencyValueField`) и числовые и
дат-диапазонные правила (`requiredNumber`, `requiredPositiveNumber`, `positiveNumber`,
`notPastDate`, `notEarlierThan`) не переносятся: сумма здесь — строка и целые минимальные единицы,
см. [«Поле суммы»](#поле-суммы).

## Где что лежит

- `features/<Feature>/validation.ts` — схемы фичи. Статичная схема или её общая часть —
  `UPPER_SNAKE_CASE` (`ACCOUNT_ENTRIES`), зависящая от контекста — функция: `getAccountFormSchema(form)`
  строит схему по типу счёта и валюте формы, `getOperationFormSchema(form, context)` — по виду
  операции и валютам выбранных счетов.
- `services/validation/schemas.ts` — общие правила, их отдаёт `index.ts`: `requiredText`,
  `requiredOption`, `requiredDate`, `optionValue`.
- `services/validation/amountSchemas.ts` — правила сумм (`requiredPositiveAmount`,
  `optionalPositiveAmount`, `optionalSignedAmount`). `index.ts` их не отдаёт: фича импортирует их по
  пути, `@/services/validation/amountSchemas`.
- Тексты ошибок пишем **строкой прямо в правиле** (`requiredText('Введите название счёта')`), а не
  константой: сообщение читается рядом с правилом, которое его порождает.
- Схема описывает **только проверяемые поля** — остальные ключи формы valibot игнорирует.
- Правило, которое не принадлежит одному полю (`check` поверх `object`), попадает в `formError`;
  правило про соседнее поле — через `forward(check(...), ['field'])` (форма перевода: «Выберите
  другой счёт» уходит в поле `toAccountId`).

## Поле суммы

Сумма в форме — это текст, а не число: поле `InputAmountField` (`components/`) держит строку так,
как её набрали, поверх `InputText` с `inputmode="decimal"`. Дробное число в модели поля, как у
`InputNumber` и `InputCurrencyValueField` из My Lovely Car, здесь запрещено: суммы — целые со знаком
в минимальных единицах валюты, арифметика над дробями исключена
([ADR-0005](../adr/0005-money-as-signed-minor-units-moment-with-offset-computed-balance.md)).

- **Текст ↔ число — только через `@/utils/money`.** `parseAmount(text, currency)` возвращает целые
  минимальные единицы или `null`: пробелы, U+00A0 и U+202F разделяют тысячи, дробную часть отделяет
  `,` или `.`, знак `+` или `-` допустим, дробных знаков не больше, чем у валюты, — иначе `null`.
  `toAmountInputText(money)` строит текст для поля из сохранённой суммы: знак сохраняется, ноль —
  пустое поле; поле без знака получает модуль суммы. Никаких `* 100`, `/ 100`, `parseFloat` и
  `Number(text)` над суммой.
- **Валюта поля — валюта его счёта.** Поле принимает проп `currency` и показывает её код в конце;
  сумма зачисления перевода читается в валюте счёта зачисления, комиссия — в валюте счёта
  списания. Валюта берётся из формы, поэтому схема зависит от неё и собирается заново из состояния
  формы: `useFormValidation(() => getOperationFormSchema(form.value, context.value), form)`.
  Счёт или валюта ещё не выбраны — `currency: null`: правило проверяет только пустоту, а ошибку
  выбора даёт поле счёта или валюты.
- **Правила `amountSchemas.ts`.** `requiredPositiveAmount(currency, { empty, invalid })` — сумма
  обязательна и больше нуля; `optionalPositiveAmount(currency, invalid)` — пусто или больше нуля
  (комиссия); `optionalSignedAmount(currency, invalid)` — пусто или любое число, включая ноль и
  минус (начальный остаток). Пустой текст — дело правила пустоты, а не «непонятной суммы»: поле
  получает одно сообщение за раз.
- **Знак.** Поле, где знак возможен, включает `signed`: рядом появляется кнопка «±», потому что на
  цифровой клавиатуре Android минуса может не быть. Сумма операции вводится без знака — его задаёт
  вид операции ([`data-layer.md`](../architecture/data-layer.md#запись-из-форм)).
- **Перед записью текст разбирается ещё раз.** Функции фичи, собирающие модель из формы
  (`toNewOperation`, `toNewAccount`), вызываются только после `validate()` и бросают ошибку, если
  правила пропустили то, что не разбирается: сохранить вместо этого другое число хуже, чем упасть.

## Когда показываются

По сабмиту: до первой попытки сохранить форма молчит, после — поля переоцениваются на каждое
изменение, и исправленное поле сразу перестаёт быть красным. По blur не показываем: на телефоне
уход фокуса — частая случайность, и форма краснела бы во время заполнения.

## Как подключается

- Диалог (родитель формы) вызывает `useFormValidation(schema, form)` и в `saveX()` идёт
  `if (!validate()) return;` — тоста о валидации нет, ошибки видны у полей. Отдельно стоит защита
  от второго нажатия: пока запись идёт (`saving`), повторное сохранение ничего не делает.
- В watcher открытия диалога — `resetValidation()` рядом со сбросом формы.
- Ошибки уходят в подкомпонент формы пропом `errors: FormErrors` (ключи — пути valibot:
  `title`, `cardDigits.0`), `formError` — отдельным пропом.

## Как показываются

- `InputTextField`, `TextareaField`, `InputAmountField`, `CurrencySelect` и `InputDateTime`
  принимают `:error` — сами красят поле (`invalid` у PrimeVue) и рендерят сообщение.
- Поле без обёртки (`FloatLabel` + `Select`) — руками: `:invalid="Boolean(errors.x)"` и
  `<FieldError :message="errors.x" />` следом.
- Скролл к первому невалидному полю делает сам `validate()`: ищет первый `.p-invalid` в документе
  (форма на экране всегда одна), фокус ставит только в поле для ввода — не в дату (открылся бы
  календарь поверх сообщения) и не в readonly-триггер.
