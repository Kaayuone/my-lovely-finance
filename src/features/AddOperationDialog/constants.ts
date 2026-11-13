import type { OperationFormKind } from './types';

// Mutable because `SelectButton` types its `options` as `any[]`
export const OPERATION_KIND_OPTIONS: { label: string; value: OperationFormKind }[] = [
  { label: 'Расход', value: 'expense' },
  { label: 'Доход', value: 'income' },
  { label: 'Перевод', value: 'transfer' },
];

// The confirmation of the form and of the long-press sheet of the feed
export const DELETE_OPERATION_CONFIRM_HEADER = 'Удалить операцию?';
export const DELETE_OPERATION_CONFIRM_MESSAGE = 'Операция пропадёт из истории и остатков.';

// Between a main category and its subcategory on the picker trigger
export const CATEGORY_PATH_SEPARATOR = ' › ';

// Full-screen picker: on a phone a long list of options is far easier to tap than a dropdown.
// Aura centres and rounds the dialog, so those defaults are overridden here. A tablet keeps it
// full-screen, as native Android does; the header and the list stand in the content column.
export const PICKER_DIALOG_PT = {
  root: {
    class: 'bg-app m-0 h-dvh max-h-dvh w-screen max-w-none rounded-none border-0',
  },
  header: { class: 'w360:px-column-5 w360:py-5 shrink-0 px-column-4 py-4' },
  title: { class: 'w400:text-base text-sm leading-tight' },
  content: { class: 'w360:px-column-3 min-h-0 flex-1 overflow-y-auto px-column-2 pb-4' },
};

// The trigger stands in for a form field, but Aura styles an outlined secondary Button as
// transparent with a weaker border and a label in the muted text colour, so the whole control reads
// as disabled. The background and the text are restated from the form-field tokens here, the border
// by the picker, which turns it red for an error. Disabled triggers keep the Aura styling, hence
// `not-disabled:`.
export const PICKER_TRIGGER_CLASS =
  'w-full justify-start gap-3 px-3 py-2.5 not-disabled:bg-field not-disabled:text-color';
