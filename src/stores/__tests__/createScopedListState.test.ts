import { describe, expect, it, vi } from 'vitest';
import { createScopedListState } from '@/stores/createScopedListState';
import { createDeferred } from '@/__tests__/deferred';

function createState() {
  const clear = vi.fn();
  const state = createScopedListState(clear);
  return { state, clear };
}

describe('createScopedListState', () => {
  it('applies the result of a load only while its ticket is current', async () => {
    const { state } = createState();
    const first = createDeferred<string[]>();
    const second = createDeferred<string[]>();
    const applied: string[][] = [];
    const apply = (result: string[]) => applied.push(result);

    const firstLoad = state.runLoad(7, () => first.promise, apply);
    const secondLoad = state.runLoad(7, () => second.promise, apply);

    second.resolve(['second']);
    await secondLoad;
    expect(state.loading.value).toBe(false);

    first.resolve(['first']);
    await expect(firstLoad).resolves.toEqual(['first']);

    // The slow first load resolved with its data, but only the newer one reached the store
    expect(applied).toEqual([['second']]);
  });

  it('drops a load that the scope moved away from and clears on the way', async () => {
    const { state, clear } = createState();
    const pending = createDeferred<string[]>();
    const apply = vi.fn();

    const staleLoad = state.runLoad(7, () => pending.promise, apply);
    state.reset(9);
    expect(clear).toHaveBeenCalledTimes(2);

    pending.resolve(['stale']);
    await staleLoad;

    expect(apply).not.toHaveBeenCalled();
  });

  it('starts a load for another scope by clearing the previous one first', () => {
    const { state, clear } = createState();

    state.beginLoad(7);
    state.beginLoad(7);
    expect(clear).toHaveBeenCalledTimes(1);

    state.beginLoad(9);
    expect(clear).toHaveBeenCalledTimes(2);
    expect(state.isCurrentScope(9)).toBe(true);
    expect(state.isCurrentScope(7)).toBe(false);
  });

  it('keeps loading on while the newest load is still running', async () => {
    const { state } = createState();
    const first = createDeferred<number>();
    const second = createDeferred<number>();

    const firstLoad = state.runLoad(7, () => first.promise, vi.fn());
    const secondLoad = state.runLoad(7, () => second.promise, vi.fn());

    first.resolve(1);
    await firstLoad;
    expect(state.loading.value).toBe(true);

    second.resolve(2);
    await secondLoad;
    expect(state.loading.value).toBe(false);
  });

  it('keeps loading on while an operation overlaps a load', async () => {
    const { state } = createState();
    const load = createDeferred<number>();
    const operation = createDeferred<void>();

    const pendingLoad = state.runLoad(7, () => load.promise, vi.fn());
    const pendingOperation = state.runOperation(() => operation.promise);

    operation.resolve();
    await pendingOperation;
    expect(state.loading.value).toBe(true);

    load.resolve(1);
    await pendingLoad;
    expect(state.loading.value).toBe(false);
  });

  it('reports a failed load only while its ticket is current', async () => {
    const { state } = createState();
    const stale = createDeferred<number>();
    const current = createDeferred<number>();

    const staleLoad = state.runLoad(7, () => stale.promise, vi.fn());
    const currentLoad = state.runLoad(7, () => current.promise, vi.fn());

    stale.reject(new Error('stale failure'));
    await expect(staleLoad).resolves.toBeUndefined();

    current.reject(new Error('current failure'));
    await expect(currentLoad).rejects.toThrow('current failure');
    expect(state.loading.value).toBe(false);
  });

  it('releases the loading flag after a failed operation and rethrows', async () => {
    const { state } = createState();

    await expect(
      state.runOperation(() => Promise.reject(new Error('write failed'))),
    ).rejects.toThrow('write failed');

    expect(state.loading.value).toBe(false);
  });

  it('lets a superseded ticket leave the flag to the load that took over', () => {
    const { state } = createState();

    const stale = state.beginLoad(7);
    const current = state.beginLoad(7);

    state.finishLoad(stale);
    expect(state.loading.value).toBe(true);
    expect(state.isCurrentLoad(stale)).toBe(false);
    expect(state.isCurrentLoad(current)).toBe(true);

    state.finishLoad(current);
    expect(state.loading.value).toBe(false);
  });
});
