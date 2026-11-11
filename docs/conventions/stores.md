# Pinia-сторы

> **Статус:** действует
>
> **Сверен:** 12 ноября 2026 — `stores/accountStore.ts`, `categoryStore.ts`, `operationStore.ts`, перенесённый `createScopedListState.ts` и `constants/operation.ts`; контракты загрузок и мутаций модели
>
> **Пересмотр:** при изменении контракта сторов со списком или записи настроек в `settingsStore`

Правила кода сторов `src/stores/` и того, как страница перезагружает их списки. Репозиторий, который
стор вызывает, — [`entities-and-sqlite.md`](entities-and-sqlite.md).

- Используем **setup-style** `defineStore('name', () => { ... })` и экспортируем `useXStore`.
- Состояние — через `ref()`; у стора, который ходит в репозиторий, есть флаг
  `loading = ref(false)`. `settingsStore` его не держит: настройки читаются до `app.mount`.
- Стор — единственный потребитель репозитория сущности; импортируем его как namespace:
  `import * as operationRepository from '@/entities/operation/operation.repository'`.
- Компоненты ходят за данными только через сторы, а не напрямую в репозитории.
- Асинхронное действие, управляющее `loading`, оборачиваем в `try / finally`: в `try` — вызов
  репозитория, в `finally` — сброс `loading` или счётчика активных операций. Ошибка автоматически
  пробрасывается вызывающему коду; не добавляем семантически пустой `catch (err) { throw err }`.
  В сторах со списком, привязанным к scope, этот `try / finally` спрятан в `runOperation` /
  `runLoad` из `stores/createScopedListState.ts` — см. ниже.
- `catch` используем только для реальной обработки: добавить контекст, преобразовать ошибку,
  выполнить компенсацию или условно подавить устаревший результат.
- `settingsStore` применяет настройку сразу и затем пишет её через `services/preferences` — только
  ключом из `PREFERENCE_KEYS`; неудачная запись оставляет выбор на этот запуск и отклоняет промис,
  чтобы вызывающий код знал, что выбор не сохранён. Не выносим этот контракт в общий
  composable/helper, пока он не нужен другому стору.
- В шаблонах разворачивать реактивное состояние через `storeToRefs`.

**Сторы со списком** — для сторов, которые держат массив сущностей:

- Машинерия стора, чей список принадлежит выбранному объекту (scope — например, счёт), — общий
  helper `createScopedListState(clear)` из `stores/createScopedListState.ts`: он держит `loading`,
  поколение загрузки и текущий scope. Helper перенесён из My Lovely Car
  (`src/stores/createScopedListState.ts`); его первый потребитель — `useOperationStore`.
  Стор вызывает `runLoad(scopeId, work, apply)` в `load*` — результат применяется, а ошибка
  пробрасывается, только пока загрузка актуальна (не пришла более новая, scope не сменился,
  `reset` не вызывали);
  `runOperation(work)` — в мутациях и в чтениях, которые список не хранит; `reset(null)` — в
  `clear*`. Низкоуровневые `beginLoad` / `isCurrentLoad` / `finishLoad` / `startOperation` /
  `finishOperation` нужны только когда у стора вторая независимая загрузка. Плоский список без
  scope helper не использует.

- В `useOperationStore` scope — выбранный счёт или все счета: `ALL_ACCOUNTS_SCOPE_ID = 0`
  (реальные id начинаются с 1). `loadOperations(accountId?)` заменяет первую порцию,
  `loadMoreOperations()` дописывает следующую по курсору последней операции `(occurredAt, id)`.
  Размер порции — `OPERATIONS_PAGE_SIZE = 50`; `hasMore` истинен после полной порции, поэтому
  возможен заключительный пустой запрос. Порция «ещё» — тоже `runLoad` того же scope, а не
  `runOperation`: новая `loadOperations` любого scope или `clearOperations` делает её устаревшей.
  Устаревший ответ не меняет список, его ошибка не пробрасывается, завершение не сбрасывает
  `loading` новой загрузки. Если список пуст, `hasMore` ложен или `loading` истинен (в том числе
  во время мутации), «ещё» ничего не запрашивает. `clearOperations()` вызывает `reset(null)` и
  очищает список вместе с `hasMore`.
- `useAccountStore` загружает счета, карты и вычисленные балансы параллельно, применяя результат
  после успеха всех трёх запросов; балансы держит в `Map` по id счёта. `useCategoryStore` хранит
  плоский список и строит два computed-дерева, включая скрытые категории. Эти списки без scope
  используют `loading` с `try / finally`, без helper.

- Мутирующие действия (`add*` / `update*` / `remove*`) **не** правят массив вручную
  (без `push` / `splice` / `filter`) и **не** перезагружают список внутри себя — только вызов
  репозитория.
- Публичный `load*` обновляет ref списка из репозитория и управляет `loading`.
- Сброс списка без загрузки — через `clear*` (`clearOperations`); страница **не** мутирует refs
  стора напрямую (`operations.value = []`).
- Перезагрузку списка после мутации вызывает **родительская страница** по событию от дочернего
  компонента (диалог эмитит `added` / `updated` / `deleted`, страница слушает `@added="loadItems"`).
- Страница сама решает, нужна ли ей перезагрузка: `onMounted`, смена контекста и обработчики событий
  дочерних компонентов.

```typescript
// List bound to a scope
export const useItemStore = defineStore('items', () => {
  const items = ref<Item[]>([]);
  const { loading, reset, runLoad, runOperation } = createScopedListState(() => {
    items.value = [];
  });

  async function loadItemsByAccountId(accountId: number) {
    await runLoad(
      accountId,
      () => itemRepository.getItemsByAccountId(accountId),
      loadedItems => {
        items.value = loadedItems;
      },
    );
  }

  async function addItem(accountId: number, data: Omit<NewItem, 'accountId'>) {
    return runOperation(() => itemRepository.insertItem(accountId, data));
  }

  function clearItems() {
    reset(null);
  }

  return { items, loading, loadItemsByAccountId, addItem, clearItems };
});

// Flat list without a scope
export const useFlatStore = defineStore('flat', () => {
  const loading = ref(false);
  const items = ref<Item[]>([]);

  async function loadItems() {
    loading.value = true;
    try {
      items.value = await itemRepository.getItems();
    } finally {
      loading.value = false;
    }
  }

  return { items, loading, loadItems };
});
```

```vue
<!-- page -->
<AddItemDialog v-model="isOpen" @added="loadItems" />
```
