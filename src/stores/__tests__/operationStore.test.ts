import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createDeferred } from '@/__tests__/deferred';
import type { NewOperation, Operation } from '@/entities/operation/operation.types';

const operationRepository = vi.hoisted(() => ({
  getOperationsPage: vi.fn(),
  insertOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(),
}));

vi.mock('@/entities/operation/operation.repository', () => operationRepository);

import { useOperationStore } from '@/stores/operationStore';

function operation(id: number, accountId = 7): Operation {
  return {
    id,
    kind: 'expense',
    accountId,
    amountMinor: -1250,
    toAccountId: null,
    toAmountMinor: null,
    feeMinor: null,
    feeCategoryId: null,
    categoryId: null,
    payee: null,
    note: null,
    originalAmountMinor: null,
    originalCurrency: null,
    occurredAt: 1700000000000 + Math.floor(id / 2) * 1000,
    utcOffsetMin: 180,
    source: 'manual',
  };
}

function page(startId = 100, count = 50, accountId = 7): Operation[] {
  return Array.from({ length: count }, (_, index) => operation(startId - index, accountId));
}

function newOperation(): NewOperation {
  return {
    kind: 'transfer',
    accountId: 7,
    amountMinor: -2000,
    toAccountId: 9,
    toAmountMinor: 2000,
    feeMinor: -20,
    feeCategoryId: 4,
    occurredAt: 1700000000000,
    utcOffsetMin: 180,
    note: 'Перевод',
    source: 'manual',
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  operationRepository.getOperationsPage.mockResolvedValue(page());
});

describe('operationStore', () => {
  it.each([7, undefined])(
    'loads 50 operations with account filter %s and replaces the list',
    async accountId => {
      const store = useOperationStore();

      await store.loadOperations(accountId);

      expect(operationRepository.getOperationsPage).toHaveBeenCalledExactlyOnceWith(
        accountId === undefined ? { limit: 50 } : { limit: 50, accountId },
      );
      expect(store.operations).toEqual(page());
      expect(store.hasMore).toBe(true);
      expect(store.loading).toBe(false);

      const replacement = page(200, 2);
      operationRepository.getOperationsPage.mockResolvedValueOnce(replacement);
      await store.loadOperations(accountId);
      expect(store.operations).toEqual(replacement);
      expect(store.hasMore).toBe(false);
    },
  );

  it.each([7, undefined])(
    'continues from the last operation with account filter %s',
    async accountId => {
      const store = useOperationStore();
      await store.loadOperations(accountId);
      const next = page(50);
      operationRepository.getOperationsPage.mockResolvedValueOnce(next);

      await store.loadMoreOperations();

      expect(operationRepository.getOperationsPage).toHaveBeenNthCalledWith(2, {
        limit: 50,
        ...(accountId === undefined ? {} : { accountId }),
        before: { occurredAt: operation(51).occurredAt, id: 51 },
      });
      expect(store.operations).toEqual([...page(), ...next]);
      expect(store.hasMore).toBe(true);

      const last = [{ ...operation(120), occurredAt: operation(1).occurredAt - 1000 }];
      operationRepository.getOperationsPage.mockResolvedValueOnce(last);
      await store.loadMoreOperations();

      expect(operationRepository.getOperationsPage).toHaveBeenNthCalledWith(3, {
        limit: 50,
        ...(accountId === undefined ? {} : { accountId }),
        before: { occurredAt: operation(1).occurredAt, id: 1 },
      });
      expect(store.operations).toEqual([...page(), ...next, ...last]);
      expect(store.hasMore).toBe(false);
      expect(store.loading).toBe(false);
    },
  );

  it('does not request more before the first load, after an empty page or after the last page', async () => {
    const store = useOperationStore();
    await store.loadMoreOperations();
    expect(operationRepository.getOperationsPage).not.toHaveBeenCalled();

    operationRepository.getOperationsPage.mockResolvedValueOnce([]);
    await store.loadOperations();
    await store.loadMoreOperations();
    expect(store.operations).toEqual([]);
    expect(store.hasMore).toBe(false);
    expect(operationRepository.getOperationsPage).toHaveBeenCalledTimes(1);

    operationRepository.getOperationsPage.mockResolvedValueOnce(page(100, 3));
    await store.loadOperations();
    await store.loadMoreOperations();
    expect(operationRepository.getOperationsPage).toHaveBeenCalledTimes(2);
  });

  it('does not request more during a first-page reload and requests a pending next page only once', async () => {
    const store = useOperationStore();
    await store.loadOperations(7);
    const reload = createDeferred<Operation[]>();
    operationRepository.getOperationsPage.mockReturnValueOnce(reload.promise);
    const reloading = store.loadOperations(7);

    await store.loadMoreOperations();
    expect(operationRepository.getOperationsPage).toHaveBeenCalledTimes(2);
    reload.resolve(page());
    await reloading;

    const pending = createDeferred<Operation[]>();
    operationRepository.getOperationsPage.mockReturnValueOnce(pending.promise);
    const firstMore = store.loadMoreOperations();
    const secondMore = store.loadMoreOperations();
    expect(store.loading).toBe(true);
    expect(operationRepository.getOperationsPage).toHaveBeenCalledTimes(3);
    pending.resolve(page(50, 2));
    await Promise.all([firstMore, secondMore]);

    expect(store.operations).toEqual([...page(), ...page(50, 2)]);
    expect(store.loading).toBe(false);
  });

  it.each(['first', 'next'])(
    'propagates the current %s-page error without changing the list',
    async pageType => {
      const store = useOperationStore();
      await store.loadOperations(7);
      const error = new Error('Read failed');
      operationRepository.getOperationsPage.mockRejectedValueOnce(error);

      const load = pageType === 'first' ? store.loadOperations(7) : store.loadMoreOperations();
      await expect(load).rejects.toBe(error);

      expect(store.operations).toEqual(page());
      expect(store.hasMore).toBe(true);
      expect(store.loading).toBe(false);
    },
  );

  describe.each(['first', 'next'])('stale %s page', pageType => {
    describe.each([
      { name: 'the same account', accountId: 7 },
      { name: 'another account', accountId: 9 },
      { name: 'all accounts', accountId: undefined },
    ])('after a load for $name', ({ accountId }) => {
      it.each(['result', 'error'])(
        'ignores a stale %s and leaves loading to the newer request',
        async outcome => {
          const store = useOperationStore();
          await store.loadOperations(7);
          const stale = createDeferred<Operation[]>();
          const current = createDeferred<Operation[]>();
          operationRepository.getOperationsPage
            .mockReturnValueOnce(stale.promise)
            .mockReturnValueOnce(current.promise);
          const staleLoad =
            pageType === 'first' ? store.loadOperations(7) : store.loadMoreOperations();
          const currentLoad = store.loadOperations(accountId);

          const expectedBeforeCurrent = accountId === 7 ? page() : [];
          expect(store.operations).toEqual(expectedBeforeCurrent);
          expect(store.hasMore).toBe(accountId === 7);
          if (outcome === 'error') stale.reject(new Error('Stale failure'));
          else stale.resolve(page(50, 2));
          await expect(staleLoad).resolves.toBeUndefined();

          expect(store.operations).toEqual(expectedBeforeCurrent);
          expect(store.hasMore).toBe(accountId === 7);
          expect(store.loading).toBe(true);

          const newest = page(300, 3, accountId ?? 7);
          current.resolve(newest);
          await currentLoad;
          expect(store.operations).toEqual(newest);
          expect(store.hasMore).toBe(false);
          expect(store.loading).toBe(false);
        },
      );

      it('keeps the newer page when an older response arrives last', async () => {
        const store = useOperationStore();
        await store.loadOperations(7);
        const stale = createDeferred<Operation[]>();
        operationRepository.getOperationsPage.mockReturnValueOnce(stale.promise);
        const staleLoad =
          pageType === 'first' ? store.loadOperations(7) : store.loadMoreOperations();
        const newest = page(300, 3, accountId ?? 7);
        operationRepository.getOperationsPage.mockResolvedValueOnce(newest);
        await store.loadOperations(accountId);

        stale.resolve(page(50));
        await staleLoad;

        expect(store.operations).toEqual(newest);
        expect(store.hasMore).toBe(false);
        expect(store.loading).toBe(false);
      });
    });

    it.each(['result', 'error'])('ignores a stale %s after clearOperations', async outcome => {
      const store = useOperationStore();
      await store.loadOperations(7);
      const stale = createDeferred<Operation[]>();
      operationRepository.getOperationsPage.mockReturnValueOnce(stale.promise);
      const staleLoad = pageType === 'first' ? store.loadOperations(7) : store.loadMoreOperations();

      store.clearOperations();
      expect(store.operations).toEqual([]);
      expect(store.hasMore).toBe(false);
      expect(store.loading).toBe(false);
      if (outcome === 'error') stale.reject(new Error('Stale failure'));
      else stale.resolve(page(50));
      await expect(staleLoad).resolves.toBeUndefined();

      expect(store.operations).toEqual([]);
      expect(store.hasMore).toBe(false);
      expect(store.loading).toBe(false);
      await store.loadMoreOperations();
      expect(operationRepository.getOperationsPage).toHaveBeenCalledTimes(2);
    });
  });

  const mutations = [
    {
      name: 'addOperation',
      invoke: (store: ReturnType<typeof useOperationStore>) => store.addOperation(newOperation()),
      repository: operationRepository.insertOperation,
      args: [newOperation()],
      result: 120,
    },
    {
      name: 'updateOperation',
      invoke: (store: ReturnType<typeof useOperationStore>) =>
        store.updateOperation(100, newOperation()),
      repository: operationRepository.updateOperation,
      args: [100, newOperation()],
      result: undefined,
    },
    {
      name: 'deleteOperation',
      invoke: (store: ReturnType<typeof useOperationStore>) => store.deleteOperation(100),
      repository: operationRepository.deleteOperation,
      args: [100],
      result: undefined,
    },
  ];

  it.each(mutations)(
    '$name forwards arguments, keeps the list and prevents loading more during a write',
    async mutation => {
      const store = useOperationStore();
      await store.loadOperations(7);
      const pending = createDeferred<number | undefined>();
      mutation.repository.mockReturnValueOnce(pending.promise);

      const write = mutation.invoke(store);
      expect(store.loading).toBe(true);
      expect(mutation.repository).toHaveBeenCalledExactlyOnceWith(...mutation.args);
      await store.loadMoreOperations();
      expect(operationRepository.getOperationsPage).toHaveBeenCalledOnce();
      expect(store.operations).toEqual(page());
      pending.resolve(mutation.result);
      await expect(write).resolves.toBe(mutation.result);

      expect(store.loading).toBe(false);
      expect(store.operations).toEqual(page());
      expect(store.hasMore).toBe(true);
      expect(operationRepository.getOperationsPage).toHaveBeenCalledOnce();
    },
  );

  it.each(mutations)('$name propagates repository errors and releases loading', async mutation => {
    const store = useOperationStore();
    const error = new Error('Write failed');
    mutation.repository.mockRejectedValueOnce(error);

    await expect(mutation.invoke(store)).rejects.toBe(error);

    expect(store.loading).toBe(false);
  });

  it('keeps loading until both an overlapping mutation and load finish', async () => {
    const store = useOperationStore();
    const pendingWrite = createDeferred<void>();
    const pendingLoad = createDeferred<Operation[]>();
    operationRepository.deleteOperation.mockReturnValueOnce(pendingWrite.promise);
    operationRepository.getOperationsPage.mockReturnValueOnce(pendingLoad.promise);

    const write = store.deleteOperation(100);
    const load = store.loadOperations(7);
    pendingLoad.resolve(page());
    await load;
    expect(store.loading).toBe(true);
    await store.loadMoreOperations();
    expect(operationRepository.getOperationsPage).toHaveBeenCalledOnce();

    pendingWrite.resolve();
    await write;
    expect(store.loading).toBe(false);
  });
});
