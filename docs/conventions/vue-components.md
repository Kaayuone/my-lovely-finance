# Vue-компоненты

> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — правила ESLint для `.vue` в `eslint.config.ts` и `.vue`-файлы `src/`, включая порядок и группировку импортов
>
> **Пересмотр:** при изменении порядка объявлений, импортов или атрибутов, правил ESLint для `.vue` в `eslint.config.ts`

Правила кода `.vue`-файлов: порядок в `<script setup>`, импорты, атрибуты в шаблоне, имена. Стили и
адаптив — [`styles-and-layout.md`](styles-and-layout.md), списки —
[`virtual-scroller.md`](virtual-scroller.md), формы — [`form-validation.md`](form-validation.md).

## Скрипт

- Всегда `<script setup lang="ts">`, Composition API.

**Порядок объявлений** — между блоками пустая строка (как между категориями импортов):

1. Импорты — см. раздел [Импорты](#импорты-vue)
2. Локально объявленные типы (`type`, `interface`) — пока файл не разросся и тип не выносится в `types.ts`
3. Локально объявленные константы (`UPPER_SNAKE_CASE`, `Map`, массивы-словари) — пока файл не разросся
   и константы не выносятся в `constants.ts` (ориентир ~150–200 строк)
4. `defineProps`
5. `defineEmits`
6. `ref`
7. `reactive`
8. `useTemplateRef` (template refs)
9. Composables — вызовы `useXxx()` (`useSettingsStore`, `useRoute`, `useRouter` и т.п.)
10. Writable `computed` (v-model-обёртки и прочие с `get` + `set`)
11. `computed` (только чтение)
12. `watch` / `watchEffect`
13. Хуки — `onMounted`, `onBeforeRouteLeave` и т.п.
14. Async-функции (`async function` / `async` стрелочные обработчики)
15. Функции (`function` / стрелочные обработчики)
16. `defineExpose`

В блоке функций (п. 14–15) **`async` всегда выше обычных** — сначала все асинхронные, затем синхронные.

```typescript
async function saveOperation() {
  /* ... */
}

function onAccountChange(accountId: number | null) {
  /* ... */
}
```

- Пропсы — через деструктуризацию `defineProps`: `const { modelValue, preset } = defineProps<{...}>()`.
- Эмиты — типизированные; для v-model используем событие `'update:model-value'`.
- Двусторонний v-model оборачиваем в writable `computed({ get, set })` — в блоке writable computeds, до read-only computeds;
  для дочерней формы допустим `defineModel` (то же связывание, удобнее для полей объекта).
- Состояние формы между диалогом и подкомпонентом — через `v-model`, без `useTemplateRef` / `defineExpose`,
  если хватает данных и событий. `defineExpose` + `useTemplateRef` — только когда императивный вызов
  действительно нужен (напр. диалог, который выбирает подкомпонент формы динамически).
- Формы-фичи валидируют и сохраняют в диалоге-родителе по `@save` от `FormDrawer`; подкомпонент формы
  только рендерит поля и держит `v-model` с родителем. `FormDrawer` переносится из My Lovely Car
  (`src/components/FormDrawer.vue`) с первой формой.
- Константы-словари (`Map`, массивы-опции, числовые пороги) — в `<script setup>`, пока компонент
  небольшой (`NAV_MENU_ITEMS` в `AppMenu.vue`); при ~150–200 строках или при использовании в
  нескольких файлах директории — в `constants.ts`.
- Иконки — компоненты из `@lucide/vue`.

Composables вызываем **после** `ref` / `reactive` / `useTemplateRef`, **до** writable `computed` —
так локальное состояние объявлено раньше, а composable может принимать локальные refs
(`useSomething(localRef)`). Stores и router без зависимости от refs всё равно идут в этом блоке.
Исключение — composable, которому нужен `computed`: он стоит сразу после этого `computed`, а не
выше него (`useFormValidation(() => getSchema(limit.value), form)`).

## Импорты (Vue)

Импорты в `<script setup>` группируются в следующем порядке (комментарии к категориям не нужны):

1. Components
2. Composables
3. Services
4. Utils
5. Types
6. Constants

**Пустые строки между категориями** — только если импортов **7 и больше** строк.
При меньшем числе категории идут подряд без разделителей.

**Composables** — только Pinia-stores (`useXxxStore`) и композаблы с префиксом `use`
(`useRouter`, `useRoute`, локальные `useXxx` из `./useXxx` и т.п.).
Даже если из одного модуля нужны и значение, и тип — значение здесь, тип в **Types**
(дублирование строк из одного пакета допустимо).

**Utils** — всё остальное из npm и локальных хелперов: `ref`, `computed`, `watch`, `onMounted`,
`useTemplateRef` из `vue`; функции из `@/utils/` и т.п.

**Constants** — глобальные константы из `@/constants/` и локальные из `./constants`.

Внутри категории сортировка по пути (без пустых строк между группами пути):

1. npm-пакеты (путь без `@`, `./`, `../` — напр. `'vue'`, `'primevue/button'`)
2. alias-импорты (`@/...`)
3. импорты из текущей директории (`./...`)
4. импорты из других директорий (`../...`)

Все типы импортируем только через `import type { ... }` и только в категории **Types**
(значения и типы из одного модуля разделяем на два импорта).

Мало импортов (< 7 строк) — без пустых строк:

```vue
<script setup lang="ts">
import Drawer from 'primevue/drawer';
import { useOperationStore } from '@/stores/operationStore';
import { computed } from 'vue';
import { formatAmount } from './utils';
import type { OperationForm } from './types';
</script>
```

Много импортов (≥ 7 строк) — пустая строка между категориями, внутри категории — подряд:

```vue
<script setup lang="ts">
import Drawer from 'primevue/drawer';
import { Wallet } from '@lucide/vue';
import OperationAmountField from './components/OperationAmountField.vue';

import { useOperationStore } from '@/stores/operationStore';
import { useOperationForm } from './useOperationForm';

import { computed, ref } from 'vue';
import { formatAmount } from './utils';

import type { Ref } from 'vue';
import type { OperationForm } from './types';
</script>
```

## Шаблон

**Порядок пропсов** — атрибуты/пропсы в шаблоне располагай в таком порядке:

1. Всё, что по правилам Vue стоит выше `v-model` (`is`, `id`, `ref`, `key`, директивы и т.п.).
2. `v-model`.
3. Динамические пропсы с выражением: `:prop="someValue"`.
4. Сокращённые динамические пропсы (shorthand): `:prop`.
5. Статические строковые пропсы: `prop="string value"`.
6. Булевы пропсы без значения: `boolean-prop`.

Пункты 1–2 проверяет `vue/attributes-order` и чинит `npm run lint`; порядок внутри пункта 3–6
линтер выразить не может — он остаётся договорённостью. Сокращения `:prop` и `boolean-prop`
требуют `vue/v-bind-style` и `vue/prefer-true-attribute-shorthand`.

```vue
<!-- ✅ -->
<MyInput
  id="title"
  ref="inputRef"
  v-model="form.title"
  :options="options"
  :placeholder
  label="Название"
  required
/>
```

## Именование (Vue)

- Страницы-роуты: префикс `The*` (`TheInbox.vue`), лежат в `pages/<name>/`.
- Диалоги/фичи: `Add*Dialog.vue` в `features/`. Подкомпоненты фичи — в `components/`,
  если их **3 и больше**; при 1–2 — рядом с диалогом (`AddAccountForm.vue`).
