import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppToast } from '@/services/feedback';
import { vibrateError, vibrateSuccess } from '@/services/haptics';
import type { ErrorOperationKind, SuccessOperationKind } from '@/services/feedback';

const { add } = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add }),
}));

vi.mock('@/services/haptics', () => ({
  vibrateError: vi.fn(),
  vibrateSuccess: vi.fn(),
}));

describe('useAppToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<{ kind: SuccessOperationKind; summary: string; detail: string }>([
    { kind: 'createAccount', summary: 'Сохранено', detail: 'Счёт добавлен' },
    { kind: 'updateAccount', summary: 'Сохранено', detail: 'Счёт сохранён' },
    { kind: 'archiveAccount', summary: 'Архивировано', detail: 'Счёт убран в архив' },
    { kind: 'restoreAccount', summary: 'Восстановлено', detail: 'Счёт возвращён из архива' },
    { kind: 'deleteAccount', summary: 'Удалено', detail: 'Счёт удалён' },
    { kind: 'createOperation', summary: 'Сохранено', detail: 'Операция добавлена' },
    { kind: 'updateOperation', summary: 'Сохранено', detail: 'Операция сохранена' },
    { kind: 'deleteOperation', summary: 'Удалено', detail: 'Операция удалена' },
  ])('shows the success message and haptics for $kind', ({ kind, summary, detail }) => {
    const { showOperationSuccess } = useAppToast();

    showOperationSuccess(kind);

    expect(add).toHaveBeenCalledExactlyOnceWith({
      severity: 'success',
      summary,
      detail,
      life: 3000,
    });
    expect(vibrateSuccess).toHaveBeenCalledOnce();
    expect(vibrateError).not.toHaveBeenCalled();
  });

  it.each<{ kind: ErrorOperationKind; detail: string }>([
    { kind: 'loadAccounts', detail: 'Не удалось загрузить счета' },
    { kind: 'createAccount', detail: 'Не удалось добавить счёт' },
    { kind: 'updateAccount', detail: 'Не удалось сохранить счёт' },
    { kind: 'archiveAccount', detail: 'Не удалось убрать счёт в архив' },
    { kind: 'restoreAccount', detail: 'Не удалось вернуть счёт из архива' },
    { kind: 'deleteAccount', detail: 'Не удалось удалить счёт' },
    { kind: 'loadCategories', detail: 'Не удалось загрузить категории' },
    { kind: 'loadOperations', detail: 'Не удалось загрузить операции' },
    { kind: 'createOperation', detail: 'Не удалось добавить операцию' },
    { kind: 'updateOperation', detail: 'Не удалось сохранить операцию' },
    { kind: 'deleteOperation', detail: 'Не удалось удалить операцию' },
    { kind: 'setupNativeFeatures', detail: 'Не удалось подключить кнопку «Назад» и клавиатуру' },
  ])('shows the error message and haptics for $kind without an error', ({ kind, detail }) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { showOperationError } = useAppToast();

    showOperationError(kind);

    expect(add).toHaveBeenCalledExactlyOnceWith({
      severity: 'error',
      summary: 'Ошибка',
      detail,
      life: 5000,
    });
    expect(vibrateError).toHaveBeenCalledOnce();
    expect(vibrateSuccess).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('logs the original error and keeps the operation message in the toast', () => {
    const error = new Error('Database write failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { showOperationError } = useAppToast();

    showOperationError('deleteOperation', error);

    expect(add).toHaveBeenCalledExactlyOnceWith({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось удалить операцию',
      life: 5000,
    });
    expect(vibrateError).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledExactlyOnceWith('Не удалось удалить операцию', error);
  });
});
