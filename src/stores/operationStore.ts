import { defineStore } from 'pinia';
import { ref } from 'vue';

import { ALL_ACCOUNTS_SCOPE_ID, OPERATIONS_PAGE_SIZE } from '@/constants/operation';
import * as operationRepository from '@/entities/operation/operation.repository';
import { createScopedListState } from '@/stores/createScopedListState';

import type { NewOperation, Operation } from '@/entities/operation/operation.types';

export const useOperationStore = defineStore('operations', () => {
  const operations = ref<Operation[]>([]);
  const hasMore = ref(false);
  let currentAccountId: number | undefined;

  const { loading, reset, runLoad, runOperation } = createScopedListState(() => {
    operations.value = [];
    hasMore.value = false;
  });

  async function loadOperations(accountId?: number) {
    currentAccountId = accountId;

    await runLoad(
      accountId ?? ALL_ACCOUNTS_SCOPE_ID,
      () =>
        operationRepository.getOperationsPage({
          limit: OPERATIONS_PAGE_SIZE,
          ...(accountId === undefined ? {} : { accountId }),
        }),
      page => {
        operations.value = page;
        hasMore.value = page.length === OPERATIONS_PAGE_SIZE;
      },
    );
  }

  async function loadMoreOperations() {
    const lastOperation = operations.value.at(-1);
    if (!lastOperation || !hasMore.value || loading.value) return;

    await runLoad(
      currentAccountId ?? ALL_ACCOUNTS_SCOPE_ID,
      () =>
        operationRepository.getOperationsPage({
          limit: OPERATIONS_PAGE_SIZE,
          ...(currentAccountId === undefined ? {} : { accountId: currentAccountId }),
          before: { occurredAt: lastOperation.occurredAt, id: lastOperation.id },
        }),
      page => {
        operations.value = [...operations.value, ...page];
        hasMore.value = page.length === OPERATIONS_PAGE_SIZE;
      },
    );
  }

  function clearOperations() {
    reset(null);
  }

  async function addOperation(operation: NewOperation) {
    return runOperation(() => operationRepository.insertOperation(operation));
  }

  async function updateOperation(id: number, operation: NewOperation) {
    await runOperation(() => operationRepository.updateOperation(id, operation));
  }

  async function deleteOperation(id: number) {
    await runOperation(() => operationRepository.deleteOperation(id));
  }

  return {
    operations,
    hasMore,
    loading,
    loadOperations,
    loadMoreOperations,
    clearOperations,
    addOperation,
    updateOperation,
    deleteOperation,
  };
});
