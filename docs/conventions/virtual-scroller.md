# VirtualScroller

> **Статус:** действует
>
> **Сверен:** 13 ноября 2026 — `package.json` (`vue-virtual-scroller` 3.0.5) и его типы (`RecycleScroller.vue.d.ts`, `DynamicScroller`), `main.ts`, `router/index.ts`, `DefaultLayout.vue`, `utils/scroller.ts`, `pages/operations/` (`TheOperations.vue`, `utils.ts`, `types.ts`); `px-column-*` и роль `text-line` в `assets/main.css`
>
> **Пересмотр:** при обновлении `vue-virtual-scroller` (в частности передачи `emit-update` и события `scroll-end`), при изменении `itemVersion`, `reloadPinningTop` или `withDayHeadings`; со вторым списком на скроллере

Длинные прокручиваемые списки на страницах — через **`vue-virtual-scroller`**
(`DynamicScroller` + `DynamicScrollerItem`). Плагин и стили подключены глобально в `main.ts`.

Сейчас на скроллере одна страница — лента «Операций» (`src/pages/operations/TheOperations.vue`), она
и эталон для следующих. «Счета» — короткий список без скроллера. Из My Lovely Car перенесены
подключение плагина и стилей, поле `virtualScroller` в `RouteMeta` (`src/router/index.ts`) с его
обработкой в `DefaultLayout`, `itemVersion`, `reloadPinningTop` и `ScrollerHandle`
(`src/utils/scroller.ts`). `withSeparators` (`src/utils/listSeparators.ts`) не переносился: ленте
нужны заголовки дней, и у неё свой `withDayHeadings` (`src/pages/operations/utils.ts`); первый
список с линиями между строками и без заголовков перенесёт `withSeparators`.

- Импорт в категории **Components**: `import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';`
- У роута страницы — `meta: { virtualScroller: true }` (так у «Операций»): `DefaultLayout` не
  добавляет `px-column-4` на `<main>`, отступы задаём на скроллере.
- Классы скроллера: `class="px-column-2 h-full py-2"` — колоночный отступ держит список в колонке
  планшета.
- **Высота элемента зависит только от его данных.** Скроллер кеширует размер по `id` и меряет
  элемент, только когда меняется его собственный бокс: view, отданный другому `id` той же высоты, не
  перемеряется, и элемент, выросший из-за соседей, наезжает на следующий. Поэтому разделитель и
  заголовок — отдельные элементы `:items` со своим `id` и `kind`, а условий по индексу и соседям
  (`index !== items.length - 1`) в элементе нет. Лента собирается `withDayHeadings(rows, today)`:
  заголовок дня (`h:<id первой строки дня>`), строка (`r:<id>:<версия>`) и разделитель после каждой
  строки, кроме последней (`s:<id строки над ним>`) — он стоит и над заголовком следующего дня; в
  слоте строка — `entry.row`.
- **Ключ строки несёт версию её данных** — `itemVersion` из `@/utils/scroller`, короткий хэш JSON.
  Строка, изменившаяся вне видимой части, возвращается в переиспользованный view той же высоты, и с
  прежним `id` осталась бы с размером из кеша — наложение на соседа или зазор. Новая версия — новый
  `id`, и скроллер меряет строку заново. Версия считается по всему, что строка показывает: у ленты
  это `OperationRowView` с отформатированными суммами и названиями счетов и категории, так что
  переименованный счёт даёт его строкам новый ключ. Всё, от чего зависит высота и чего нет в
  данных строки, страница обязана добавить в версию. Разделители и заголовки версии не несут: их
  высота от данных не зависит, а ключ разделителя не меняется от правки соседа. Цена: строка,
  изменённая на экране, один кадр стоит с оценкой `:min-item-size`, затем замеряется.
- `:items` — типизированный массив этих элементов (`computed` над списком стора); приведение `as` в
  слоте не нужно. `ScrollerHandle<T>` и индекс для `scrollToItem` — по элементам `:items`, а не по
  массиву стора.
- **Следующая порция — по концу списка.** Страница читает её по событию `scroll-end`, а оно приходит
  только при включённом `emit-update`: оба привязаны на `DynamicScroller`, и он через `$attrs`
  отдаёт их внутреннему `RecycleScroller`. В типах `DynamicScroller` у пакета их нет (они описаны у
  `RecycleScroller`), поэтому при обновлении пакета проверить, что передача работает. Скроллер
  сообщает о конце на каждом кадре, пока конец на экране, — страница не показывает тост ошибки на
  каждое событие: после неудачной порции следующий запрос идёт только с новым чтением списка.
  Стор ничего не читает, пока идёт загрузка или порции кончились ([`stores.md`](stores.md)).
- **Перечитать и остаться на месте.** После добавления, правки или удаления страница читает список
  заново через `reloadPinningTop(scrollerRef, reload)`: наверх он возвращает, только если список
  там и был, — читающего дальше вниз не прерывают.
- Разделитель — `<hr>` списка с его классами (`text-line mt-1 pb-1`), в своём элементе, а у
  `DynamicScrollerItem` — `class="flow-root"`: скроллер меряет его бокс, и без своего контекста
  форматирования верхний отступ одиночной линии выпадает наружу (опыт My Lovely Car: скроллер
  журнала насчитывал 5 px вместо 9, и линия ложилась вплотную к строке под ней).
- `:min-item-size` — **средняя** высота элемента в px (строки, заголовки и разделители вместе), а не
  минимальная: ею скроллер считает ещё не измеренные элементы, а у списка, где каждый второй элемент
  — линия в 9 px, оценка по строке почти вдвое удлиняет прокрутку до замера. Число и расчёт — коротким
  комментарием у скроллера (лента — `32`: строка 52–56 px, с подписью комиссии 70, линия 9, заголовок
  дня 32).
- Сдвиг всех элементов, если он нужен, — на их обёртке, `list-class`, а не отступом первого
  элемента: высота элемента не зависит от его места в списке.
- Слот `#default="{ item, index, active }"`; при необходимости переименовываем: `{ item: entry, index, active }`.
- Каждый элемент оборачиваем в `<DynamicScrollerItem :item :active :index class="flow-root">`.
- Пустые и загрузочные состояния — слот `#empty`, не внутри цикла элементов; условие — по списку
  строк стора. Место под плавающую кнопку «добавить» — слот `#after` с пустым блоком, чтобы
  последняя строка не пряталась под ней.
- В E2E строку списка ищем по роли (`getByRole` скрытое пропускает) или текстом с
  `filter({ visible: true })`: view в пуле скроллера скрыт `visibility: hidden`, но держит текст
  строки, и `getByText` найдёт его рядом с видимой — вторым совпадением или первым в DOM.
  Для отрицательной проверки строки (`toHaveCount(0)`) действует то же правило: скрытый view
  с прежним текстом не должен считаться оставшейся строкой.

```vue
<!-- `operationEntries` is `withDayHeadings(rows, today)`: `h:` headings, `r:<id>:<version>` rows and
     `s:<id>` lines -->
<!-- An item not measured yet counts as `min-item-size`, so it is the average item: a row is
     52–56 px, the separator under it 9 and a day heading 32, (54 + 9) / 2 ≈ 32 -->
<DynamicScroller
  ref="scrollerRef"
  :items="operationEntries"
  :min-item-size="32"
  class="px-column-2 h-full py-2"
  emit-update
  @scroll-end="loadMoreOperations"
>
  <template #default="{ item: entry, index, active }">
    <DynamicScrollerItem :item="entry" :active :index class="flow-root">
      <h2 v-if="entry.kind === 'heading'" class="text-muted-color px-2 pt-3 pb-1 text-xs">
        {{ entry.label }}
      </h2>

      <hr v-else-if="entry.kind === 'separator'" class="text-line mt-1 pb-1" />

      <OperationRow
        v-else
        :row="entry.row"
        v-on="bindLongPress(entry.row.operation.id)"
        @click="openEditOperationDialog(entry.row.operation)"
      />
    </DynamicScrollerItem>
  </template>

  <template #empty>
    <LoadingState v-if="isLoading" />
    <EmptyState v-else title="Операций пока нет" />
  </template>
</DynamicScroller>
```
