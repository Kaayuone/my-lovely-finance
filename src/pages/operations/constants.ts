import { Pencil, Trash2 } from '@lucide/vue';
import type { RowAction } from '@/components/RowActionsSheet.vue';
import type { OperationAction } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;

// «12 ноября»: a day heading names the month in the genitive
export const MONTH_NAMES_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

export const OPERATION_ACTIONS: RowAction<OperationAction>[] = [
  { value: 'edit', label: 'Изменить', icon: Pencil },
  { value: 'delete', label: 'Удалить', icon: Trash2, danger: true },
];

// A balance adjustment has no form yet (A1): it can only be deleted
export const ADJUSTMENT_ACTIONS: RowAction<OperationAction>[] = [
  { value: 'delete', label: 'Удалить', icon: Trash2, danger: true },
];
