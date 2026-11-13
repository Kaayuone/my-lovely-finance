import { useToast } from 'primevue/usetoast';
import { vibrateError, vibrateSuccess } from '@/services/haptics';
import { OPERATION_ERROR_MESSAGES, OPERATION_SUCCESS_MESSAGES } from './constants';
import type { ErrorOperationKind, SuccessOperationKind } from './constants';

export function useAppToast() {
  const toast = useToast();

  function showOperationError(operation: ErrorOperationKind, error?: unknown) {
    vibrateError();
    const { summary, detail } = OPERATION_ERROR_MESSAGES[operation];
    toast.add({ severity: 'error', summary, detail, life: 5000 });
    if (error !== undefined) console.error(detail, error);
  }

  function showOperationSuccess(operation: SuccessOperationKind) {
    vibrateSuccess();
    const { summary, detail } = OPERATION_SUCCESS_MESSAGES[operation];
    toast.add({ severity: 'success', summary, detail, life: 3000 });
  }

  return { showOperationError, showOperationSuccess };
}
