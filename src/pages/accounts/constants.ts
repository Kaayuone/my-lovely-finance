import { Archive, ArchiveRestore, Pencil, Trash2 } from '@lucide/vue';
import type { RowAction } from '@/components/RowActionsSheet.vue';

export type AccountAction = 'edit' | 'archive' | 'restore' | 'delete';

// The archive and the return take no confirmation: both are undone by the other one (D6)
export const ACTIVE_ACCOUNT_ACTIONS: RowAction<AccountAction>[] = [
  { value: 'edit', label: 'Изменить', icon: Pencil },
  { value: 'archive', label: 'В архив', icon: Archive },
  { value: 'delete', label: 'Удалить', icon: Trash2, danger: true },
];

export const ARCHIVED_ACCOUNT_ACTIONS: RowAction<AccountAction>[] = [
  { value: 'edit', label: 'Изменить', icon: Pencil },
  { value: 'restore', label: 'Вернуть', icon: ArchiveRestore },
  { value: 'delete', label: 'Удалить', icon: Trash2, danger: true },
];
