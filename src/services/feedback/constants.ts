export type ErrorOperationKind =
  | 'loadAccounts'
  | 'createAccount'
  | 'updateAccount'
  | 'archiveAccount'
  | 'restoreAccount'
  | 'deleteAccount'
  | 'loadCategories'
  | 'loadOperations'
  | 'createOperation'
  | 'updateOperation'
  | 'deleteOperation'
  | 'setupNativeFeatures';

export type SuccessOperationKind =
  | 'createAccount'
  | 'updateAccount'
  | 'archiveAccount'
  | 'restoreAccount'
  | 'deleteAccount'
  | 'createOperation'
  | 'updateOperation'
  | 'deleteOperation';

type ToastMessage = {
  summary: string;
  detail: string;
};

export const OPERATION_ERROR_MESSAGES: Record<ErrorOperationKind, ToastMessage> = {
  loadAccounts: { summary: 'Ошибка', detail: 'Не удалось загрузить счета' },
  createAccount: { summary: 'Ошибка', detail: 'Не удалось добавить счёт' },
  updateAccount: { summary: 'Ошибка', detail: 'Не удалось сохранить счёт' },
  archiveAccount: { summary: 'Ошибка', detail: 'Не удалось убрать счёт в архив' },
  restoreAccount: { summary: 'Ошибка', detail: 'Не удалось вернуть счёт из архива' },
  deleteAccount: { summary: 'Ошибка', detail: 'Не удалось удалить счёт' },
  loadCategories: { summary: 'Ошибка', detail: 'Не удалось загрузить категории' },
  loadOperations: { summary: 'Ошибка', detail: 'Не удалось загрузить операции' },
  createOperation: { summary: 'Ошибка', detail: 'Не удалось добавить операцию' },
  updateOperation: { summary: 'Ошибка', detail: 'Не удалось сохранить операцию' },
  deleteOperation: { summary: 'Ошибка', detail: 'Не удалось удалить операцию' },
  setupNativeFeatures: {
    summary: 'Ошибка',
    detail: 'Не удалось подключить кнопку «Назад» и клавиатуру',
  },
};

export const OPERATION_SUCCESS_MESSAGES: Record<SuccessOperationKind, ToastMessage> = {
  createAccount: { summary: 'Сохранено', detail: 'Счёт добавлен' },
  updateAccount: { summary: 'Сохранено', detail: 'Счёт сохранён' },
  archiveAccount: { summary: 'Архивировано', detail: 'Счёт убран в архив' },
  restoreAccount: { summary: 'Восстановлено', detail: 'Счёт возвращён из архива' },
  deleteAccount: { summary: 'Удалено', detail: 'Счёт удалён' },
  createOperation: { summary: 'Сохранено', detail: 'Операция добавлена' },
  updateOperation: { summary: 'Сохранено', detail: 'Операция сохранена' },
  deleteOperation: { summary: 'Удалено', detail: 'Операция удалена' },
};
