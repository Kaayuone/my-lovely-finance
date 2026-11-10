import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { runMigrations } from './migrations';
import { createTransactionRunner } from './transaction';
import { DB_NAME } from './config';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';

let sqliteConnection: SQLiteConnection | null = null;
let isWebPlatform = false;
let isConnectionOpen = false;

/**
 * Initialize database based on platform
 * - Web: uses jeep-sqlite from npm package
 * - Native (Android/iOS): uses capacitor-community/sqlite
 */
export async function initializeDatabase() {
  try {
    isConnectionOpen = false;
    const platform = Capacitor.getPlatform();
    isWebPlatform = platform === 'web';

    sqliteConnection = new SQLiteConnection(CapacitorSQLite);

    if (isWebPlatform) {
      await initJeepSqlite();
      await sqliteConnection.initWebStore();
    }

    // A reload of the page restarts this module with an empty connection registry, while the one
    // of the plugin keeps the connection of the previous page: `isConnection` below reads the
    // empty JS map, `createConnection` then fails with `Connection ... already exists`, and the
    // retry button repeats the same call forever. This closes the connections the JS side no
    // longer knows about. Runs after the web branch: the web implementation needs the
    // `jeep-sqlite` element to exist.
    await sqliteConnection.checkConnectionsConsistency();

    await prepareSchema();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function initJeepSqlite() {
  // Imported here, not at module scope: the loader carries the stencil runtime of a web component
  // the native platform never creates, and a static import would put it in the startup chunk the
  // APK parses on every cold start
  const { defineCustomElements } = await import('jeep-sqlite/loader');

  await defineCustomElements(window);

  if (!document.querySelector('jeep-sqlite')) {
    const element = document.createElement('jeep-sqlite');
    document.body.appendChild(element);
    await customElements.whenDefined('jeep-sqlite');
  }
}

/**
 * FK enforcement is per-connection, off by default and a no-op inside a transaction, so the pragma
 * is set on every fresh connection — and read back, because a silently ignored one turns every
 * `ON DELETE CASCADE` in the schema into a no-op and lets the database collect orphaned rows.
 * A connection that cannot enforce foreign keys is unusable: failing here surfaces the startup
 * error screen instead of corrupting data.
 *
 * Only the read-back decides. Android rejects this pragma through `execSQL` and enables the
 * constraints itself when the database is opened, so the statement failing there proves nothing.
 */
async function enableForeignKeys(db: SQLiteDBConnection): Promise<void> {
  try {
    await db.execute('PRAGMA foreign_keys = ON;', false);
  } catch (error) {
    console.warn('Failed to set the foreign keys pragma:', error);
  }

  const result = await db.query('PRAGMA foreign_keys;');
  // The plugin returns pragma rows untyped: documented boundary cast (AGENTS.md)
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const rows = result.values as { foreign_keys?: number }[] | undefined;
  const enabled = rows?.[0]?.foreign_keys;

  // Read back as a number: the pragma is reported as 1/0 and an unreadable answer is no proof
  if (Number(enabled) !== 1) {
    throw new Error(
      `Foreign keys are not enforced on this connection: PRAGMA foreign_keys returned ${String(enabled)}`,
    );
  }
}

/**
 * Get the database connection. If there is none, create and open it.
 */
async function getConnection(): Promise<SQLiteDBConnection> {
  if (!sqliteConnection) {
    throw new Error('SQLiteConnection not initialized. Call initializeDatabase() first.');
  }

  let db: SQLiteDBConnection;
  const isExisting = await sqliteConnection.isConnection(DB_NAME, false);
  if (isExisting.result) {
    db = await sqliteConnection.retrieveConnection(DB_NAME, false);
  } else {
    db = await sqliteConnection.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  }

  if (!isConnectionOpen) {
    await db.open();
    await enableForeignKeys(db);
    isConnectionOpen = true;
  }
  return db;
}

/**
 * Execute an SQL statement without returning data (INSERT, UPDATE, DELETE, CREATE TABLE...)
 * Every write runs inside `runInTransaction` and passes `transaction = false`, so the statement
 * joins that transaction instead of committing on its own. The default is left to the statements
 * of the start, which run before any transaction. While one is open the default is refused: Android
 * would roll the open transaction back and the web would commit it halfway (ADR-0002).
 */
export async function executeSql(sql: string, values?: unknown[], transaction = true) {
  if (transaction && (isTransactionOpen || isTransactionActive())) {
    throw new Error('executeSql must pass transaction = false while a transaction is open');
  }

  const db = await getConnection();
  try {
    if (values && values.length > 0) {
      return await db.run(sql, values, transaction);
    }
    return await db.execute(sql, transaction);
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  }
}

/**
 * Explicit transaction control, private to this module: multi-row mutations go through
 * `runInTransaction`, and the migrations runner receives these through its `MigrationSql`.
 * Both open their transactions here, so the flag below lets `executeSql` guard a migration step
 * the same way it guards the work of `runInTransaction`.
 */
let isTransactionOpen = false;

async function beginTransaction() {
  const db = await getConnection();
  await db.beginTransaction();
  isTransactionOpen = true;
}

async function commitTransaction() {
  const db = await getConnection();
  try {
    await db.commitTransaction();
  } finally {
    isTransactionOpen = false;
  }
}

async function rollbackTransaction() {
  const db = await getConnection();
  try {
    await db.rollbackTransaction();
  } finally {
    isTransactionOpen = false;
  }
}

/**
 * Runs a mutation as one transaction: begin, the work, commit; a rejection rolls back and is
 * rethrown, a commit saves the web store. Every write of the app goes through here, a lone statement
 * too, and every `executeSql` inside must pass `transaction = false`; calls that overlap run one
 * after another, and a nested call waits for itself — see `createTransactionRunner`.
 */
const transactionRunner = createTransactionRunner({
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  updateOnWeb,
});

export const runInTransaction = transactionRunner.runInTransaction;
const isTransactionActive = transactionRunner.isTransactionActive;

/**
 * Execute a SELECT query and return the result.
 */
export async function querySql<T>(sql: string, values?: unknown[]): Promise<T[]> {
  const db = await getConnection();
  try {
    const result = await db.query(sql, values);
    // The plugin returns rows untyped: documented boundary cast (AGENTS.md)
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (result.values as T[]) || [];
  } catch (error) {
    console.error('SQL query error:', error);
    throw error;
  }
}

/**
 * Brings the schema up to date: every table, index and seed row comes from the migrations
 * (ADR-0002), so a fresh install and an upgraded one end up with the same database.
 */
async function prepareSchema(): Promise<void> {
  await runMigrations({
    beginTransaction,
    commitTransaction,
    executeSql,
    querySql,
    rollbackTransaction,
  });
  await updateOnWeb();
}

// On web, data must be manually synced after changes
export async function updateOnWeb() {
  if (isWebPlatform) {
    await sqliteConnection?.saveToStore(DB_NAME);
  }
}
