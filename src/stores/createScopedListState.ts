import { ref } from 'vue';

/** Identifies one list load: the scope it was started for and its place in the order of loads. */
export type LoadTicket = { scopeId: number; generation: number };

/**
 * The bookkeeping every scoped list store shares. A load carries a ticket, and its result is
 * applied only while that ticket is current: a newer load of the same scope, a switch to another
 * scope or a `reset` all make it stale, so a slow query can never overwrite a fresher list. The one
 * `loading` flag is fed by the list load and by every operation in flight, so a mutation finishing
 * during a load does not switch the spinner off early.
 *
 * `clear` empties the refs the store keeps for the scope; it runs on every `reset`, including the
 * implicit one when a load is started for another scope.
 */
export function createScopedListState(clear: () => void) {
  const loading = ref(false);
  let scopeId: number | null = null;
  let generation = 0;
  let listLoading = false;
  let activeOperations = 0;

  function updateLoading() {
    loading.value = listLoading || activeOperations > 0;
  }

  function isCurrentScope(candidate: number | null) {
    return scopeId === candidate;
  }

  // Switches to `nextScopeId` (or to no scope at all) and drops whatever was loaded before
  function reset(nextScopeId: number | null) {
    scopeId = nextScopeId;
    generation += 1;
    listLoading = false;
    clear();
    updateLoading();
  }

  function beginLoad(nextScopeId: number): LoadTicket {
    if (scopeId !== nextScopeId) reset(nextScopeId);

    generation += 1;
    listLoading = true;
    updateLoading();
    return { scopeId: nextScopeId, generation };
  }

  function isCurrentLoad(ticket: LoadTicket) {
    return scopeId === ticket.scopeId && generation === ticket.generation;
  }

  // A load that was superseded leaves the flag to the load that superseded it
  function finishLoad(ticket: LoadTicket) {
    if (generation !== ticket.generation) return;

    listLoading = false;
    updateLoading();
  }

  // One list load end to end: the result is applied, and a failure is reported, only while the
  // ticket is current — a stale load resolves quietly, whatever happened to it
  async function runLoad<T>(
    nextScopeId: number,
    work: () => Promise<T>,
    apply: (result: T) => void,
  ): Promise<T | undefined> {
    const ticket = beginLoad(nextScopeId);

    try {
      const result = await work();
      if (isCurrentLoad(ticket)) apply(result);
      return result;
    } catch (error) {
      if (isCurrentLoad(ticket)) throw error;
      return undefined;
    } finally {
      finishLoad(ticket);
    }
  }

  function startOperation() {
    activeOperations += 1;
    updateLoading();
  }

  function finishOperation() {
    activeOperations -= 1;
    updateLoading();
  }

  // A repository call under the loading flag: a mutation, or a read the list does not keep
  async function runOperation<T>(work: () => Promise<T>): Promise<T> {
    startOperation();
    try {
      return await work();
    } finally {
      finishOperation();
    }
  }

  return {
    loading,
    isCurrentScope,
    reset,
    beginLoad,
    isCurrentLoad,
    finishLoad,
    runLoad,
    startOperation,
    finishOperation,
    runOperation,
  };
}
