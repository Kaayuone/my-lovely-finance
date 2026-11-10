# VirtualScroller

> **Статус:** действует
>
> **Сверен:** 10 ноября 2026 — `package.json`, `main.ts`, `router/index.ts`, `DefaultLayout.vue`: `vue-virtual-scroller` не установлен, `meta.virtualScroller` и списков на скроллере ещё нет; `px-column-*` и роль `text-line` в `assets/main.css` есть
>
> **Пересмотр:** с первым списком на `DynamicScroller`; при обновлении `vue-virtual-scroller` или изменении `withSeparators` и `itemVersion`

Длинные прокручиваемые списки на страницах — через **`vue-virtual-scroller`**
(`DynamicScroller` + `DynamicScrollerItem`). Плагин и стили подключаются глобально в `main.ts`.

Списков на скроллере пока нет. Пакет ставится с первым из них, и вместе с ним переносятся из
My Lovely Car: подключение плагина и стилей (`src/main.ts`), поле `virtualScroller` в `RouteMeta`
(`src/router/index.ts`) и его обработка в `DefaultLayout` (`src/pages/layouts/DefaultLayout.vue`),
`withSeparators` (`src/utils/listSeparators.ts`), `itemVersion` и `ScrollerHandle`
(`src/utils/scroller.ts`). Эталон там — журнал, `src/pages/journal/TheJournal.vue`.

- Импорт в категории **Components**: `import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';`
- У роута страницы — `meta: { virtualScroller: true }`: `DefaultLayout` не добавляет `px-column-4`
  на `<main>`, отступы задаём на скроллере.
- Классы скроллера: `class="px-column-2 h-full py-2"` — колоночный отступ держит список в колонке
  планшета.
- **Высота элемента зависит только от его данных.** Скроллер кеширует размер по `id` и меряет
  элемент, только когда меняется его собственный бокс: view, отданный другому `id` той же высоты, не
  перемеряется, и элемент, выросший из-за соседей, наезжает на следующий. Поэтому разделитель и
  заголовок — отдельные элементы `:items` со своим `id` и `kind`, а условий по индексу и соседям
  (`index !== items.length - 1`) в элементе нет:
  - список строк — `withSeparators(rows, heightInputs?)` из `@/utils/listSeparators`: строка
    `{ id: 'r:<id>:<версия>', kind: 'row', row }`, после каждой, кроме последней, — разделитель
    `{ id: 's:<id строки над ним>', kind: 'separator' }`; строка в слоте — `entry.row`;
  - список с заголовками групп (журнал My Lovely Car — `withMonthHeadings` в
    `src/pages/journal/utils.ts`): заголовок (`h:<id первой строки группы>`), строка
    (`r:<id>:<версия>`) и разделитель после каждой строки, кроме последней, — и над заголовком
    следующей группы.
- **Ключ строки несёт версию её данных** — `itemVersion` из `@/utils/scroller`, короткий хэш JSON.
  Строка, изменившаяся вне видимой части, возвращается в переиспользованный view той же высоты, и с
  прежним `id` осталась бы с размером из кеша — наложение на соседа или зазор. Новая версия — новый
  `id`, и скроллер меряет строку заново. Всё, что строка показывает помимо своих данных и от чего
  зависит её высота (напр. день, от которого считается срок), страница передаёт в `withSeparators`
  вторым аргументом — функцией строки, и это входит в версию. Разделители и заголовки версии не
  несут: их высота от данных не зависит, а ключ разделителя не меняется от правки соседа. Цена:
  строка, изменённая на экране, один кадр стоит с оценкой `:min-item-size`, затем замеряется.
- `:items` — типизированный массив этих элементов (`computed` над списком стора); приведение `as` в
  слоте не нужно. `ScrollerHandle<T>` и индекс для `scrollToItem` — по элементам `:items`, а не по
  массиву стора.
- Разделитель — `<hr>` списка с его классами (напр. `text-line mt-1 pb-1`), в своём элементе, а у
  `DynamicScrollerItem` — `class="flow-root"`: скроллер меряет его бокс, и без своего контекста
  форматирования верхний отступ одиночной линии выпадает наружу (опыт My Lovely Car: скроллер
  журнала насчитывал 5 px вместо 9, и линия ложилась вплотную к строке под ней).
- `:min-item-size` — **средняя** высота элемента в px (строки, заголовки и разделители вместе), а не
  минимальная: ею скроллер считает ещё не измеренные элементы, а у списка, где каждый второй элемент
  — линия в 9 px, оценка по строке почти вдвое удлиняет прокрутку до замера. Число и расчёт — коротким
  комментарием у скроллера (журнал My Lovely Car — `32`: запись 54–56, линия 9, заголовок 32).
- Сдвиг всех элементов — на их обёртке, `list-class` (журнал My Lovely Car — `-mt-3 pt-3`), а не
  отступом первого элемента: высота элемента не зависит от его места в списке.
- Слот `#default="{ item, index, active }"`; при необходимости переименовываем: `{ item: entry, index, active }`.
- Каждый элемент оборачиваем в `<DynamicScrollerItem :item :active :index class="flow-root">`.
- Пустые и загрузочные состояния — слот `#empty`, не внутри цикла элементов; условие — по списку
  строк стора.
- В E2E строку списка ищем по роли (`getByRole` скрытое пропускает) или текстом с
  `filter({ visible: true })`: view в пуле скроллера скрыт `visibility: hidden`, но держит текст
  строки, и `getByText` найдёт его рядом с видимой — вторым совпадением или первым в DOM.
  Для отрицательной проверки строки (`toHaveCount(0)`) действует то же правило: скрытый view
  с прежним текстом не должен считаться оставшейся строкой.

```vue
<!-- `accountEntries` is `withSeparators(accounts)`: `r:<id>:<version>` rows and `s:<id>` lines -->
<!-- An item not measured yet counts as `min-item-size`, so it is the average item: a row is
     54–56 px and the separator under it 9, (56 + 9) / 2 ≈ 32 -->
<DynamicScroller :items="accountEntries" :min-item-size="32" class="px-column-2 h-full py-2">
  <template #default="{ item: entry, index, active }">
    <DynamicScrollerItem :item="entry" :active :index class="flow-root">
      <hr v-if="entry.kind === 'separator'" class="text-line mt-1 pb-1" />

      <div v-else role="button" @click="openEditAccountDialog(entry.row)">
        <!-- содержимое строки -->
      </div>
    </DynamicScrollerItem>
  </template>

  <template #empty>
    <template v-if="loading">Загрузка...</template>
    <template v-else-if="!accounts.length">Список пуст</template>
  </template>
</DynamicScroller>
```
