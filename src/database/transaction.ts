export type TransactionSql = {
  beginTransaction: () => Promise<void>;
  commitTransaction: () => Promise<void>;
  rollbackTransaction: () => Promise<void>;
  updateOnWeb: () => Promise<void>;
};

export type RunInTransaction = <T>(work: () => Promise<T>) => Promise<T>;

export type TransactionRunner = {
  runInTransaction: RunInTransaction;
  /** Whether a transaction of the runner is running right now. */
  isTransactionActive(): boolean;
};

// A rollback rejects when the adapter has already dropped the transaction itself, a failed
// `COMMIT` being one such case; the failure that got us here is the one worth reporting
async function rollback(sql: TransactionSql): Promise<void> {
  try {
    await sql.rollbackTransaction();
  } catch (rollbackError) {
    console.error('Failed to roll back the transaction:', rollbackError);
  }
}

/**
 * Builds `runInTransaction` over the transaction control of one connection: `beginTransaction`,
 * the work, `commitTransaction`; a rejection anywhere rolls back and is rethrown, and only a
 * committed transaction saves the web store — the callers do not call `updateOnWeb` themselves.
 *
 * Every statement inside the work must pass `transaction = false` to `executeSql`. Both adapters
 * read the default as "wrap this statement in a transaction of your own": the web one
 * (jeep-sqlite) reuses the open transaction and commits it after the very first statement, the
 * native one fails with "Already in transaction" and drops the open one, after which the rest of
 * the work commits statement by statement. Either way the rollback would no longer cover the work.
 * A statement from outside that lands while a transaction is open does the same, so nothing writes
 * outside the queue: a lone write is a transaction of its own, and `executeSql` refuses the default
 * while a transaction is open (ADR-0002).
 *
 * The connection holds one transaction — a second `BEGIN` fails on the web and on Android alike —
 * so the calls form a queue: a transaction that arrives while another one is running starts once
 * that one is over, in the order of arrival. Nesting is the one thing the queue cannot serve: a
 * transaction that opens another one waits for itself, forever. A repository that composes another
 * one inside its transaction calls its `*InTransaction` functions instead.
 */
export function createTransactionRunner(sql: TransactionSql): TransactionRunner {
  let isActive = false;
  // The end of the transaction that arrived last; the next one starts after it
  let tail: Promise<void> = Promise.resolve();

  async function runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release: () => void = () => undefined;
    tail = new Promise<void>(resolve => {
      release = () => resolve();
    });

    await previous;
    try {
      return await runExclusively(work);
    } finally {
      release();
    }
  }

  async function runExclusively<T>(work: () => Promise<T>): Promise<T> {
    isActive = true;

    let result: T;
    try {
      await sql.beginTransaction();
      try {
        result = await work();
        await sql.commitTransaction();
      } catch (error) {
        await rollback(sql);
        throw error;
      }
    } finally {
      isActive = false;
    }

    await sql.updateOnWeb();
    return result;
  }

  return {
    runInTransaction,
    isTransactionActive: () => isActive,
  };
}
