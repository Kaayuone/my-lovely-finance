import { describe, expect, it, vi } from 'vitest';
import { createTransactionRunner } from '@/database/transaction';

/** Transaction control that records the order of what the runner asks of the connection. */
function createSql() {
  const calls: string[] = [];
  const record = (name: string) =>
    vi.fn(async () => {
      calls.push(name);
    });

  return {
    calls,
    sql: {
      beginTransaction: record('begin'),
      commitTransaction: record('commit'),
      rollbackTransaction: record('rollback'),
      updateOnWeb: record('updateOnWeb'),
    },
  };
}

describe('runInTransaction', () => {
  it('commits the work, saves the web store afterwards and returns the result', async () => {
    const { calls, sql } = createSql();
    const { runInTransaction } = createTransactionRunner(sql);

    const result = await runInTransaction(async () => {
      calls.push('work');
      return 42;
    });

    expect(result).toBe(42);
    expect(calls).toEqual(['begin', 'work', 'commit', 'updateOnWeb']);
  });

  it('rolls back and rethrows when the work fails, leaving the web store alone', async () => {
    const { calls, sql } = createSql();
    const { runInTransaction } = createTransactionRunner(sql);

    await expect(
      runInTransaction(async () => {
        calls.push('work');
        throw new Error('insert failed');
      }),
    ).rejects.toThrow('insert failed');

    expect(calls).toEqual(['begin', 'work', 'rollback']);
  });

  // The adapter drops the transaction itself when the commit fails, and the rollback that follows
  // rejects: the error that reaches the caller must still be the commit failure
  it('reports the failure of the work when the rollback itself is rejected', async () => {
    const { sql } = createSql();
    sql.commitTransaction.mockRejectedValue(new Error('commit failed'));
    sql.rollbackTransaction.mockRejectedValue(new Error('no transaction is active'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { runInTransaction } = createTransactionRunner(sql);

    await expect(runInTransaction(async () => undefined)).rejects.toThrow('commit failed');

    expect(sql.rollbackTransaction).toHaveBeenCalledOnce();
    expect(sql.updateOnWeb).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to roll back the transaction:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it('runs the transactions that arrive during another one after it, in order of arrival', async () => {
    const { calls, sql } = createSql();
    const { runInTransaction } = createTransactionRunner(sql);
    let finishFirst: () => void = () => undefined;

    const first = runInTransaction(async () => {
      calls.push('first');
      await new Promise<void>(resolve => {
        finishFirst = resolve;
      });
    });
    const second = runInTransaction(async () => {
      calls.push('second');
    });
    const third = runInTransaction(async () => {
      calls.push('third');
    });

    await vi.waitFor(() => expect(calls).toContain('first'));
    expect(calls).not.toContain('second');

    finishFirst();
    await Promise.all([first, second, third]);

    expect(calls).toEqual([
      'begin',
      'first',
      'commit',
      'updateOnWeb',
      'begin',
      'second',
      'commit',
      'updateOnWeb',
      'begin',
      'third',
      'commit',
      'updateOnWeb',
    ]);
  });

  it('starts the next transaction after one that failed', async () => {
    const { calls, sql } = createSql();
    const { runInTransaction } = createTransactionRunner(sql);

    const failed = runInTransaction(async () => {
      throw new Error('insert failed');
    });
    const next = runInTransaction(async () => {
      calls.push('next');
    });

    await expect(failed).rejects.toThrow('insert failed');
    await next;

    expect(calls).toEqual(['begin', 'rollback', 'begin', 'next', 'commit', 'updateOnWeb']);
  });

  it('reports a transaction as active only while its work runs', async () => {
    const { sql } = createSql();
    const { runInTransaction, isTransactionActive } = createTransactionRunner(sql);
    let activeInside = false;

    await runInTransaction(async () => {
      activeInside = isTransactionActive();
    });

    expect(activeInside).toBe(true);
    expect(isTransactionActive()).toBe(false);
  });
});
