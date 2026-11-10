import initSqlJs from 'sql.js';
import { vi } from 'vitest';
import { runMigrations } from '@/database/migrations';
import { createTransactionRunner } from '@/database/transaction';
import type { Database } from 'sql.js';
import type { Migration, MigrationSql } from '@/database/migrations';

/**
 * A real SQLite in memory for the integration tests of repositories and migrations: the same
 * statements the app runs, through the same transaction runner, against the sql.js build the web
 * runtime ships. A repository test mocks `@/database` with these functions.
 */

// The copy the app ships, not the one in node_modules: the suite runs against the exact binary that
// goes into the web build
const sqlJs = initSqlJs({
  locateFile: () => 'public/assets/sql-wasm.wasm',
});

let database: Database | null = null;
// Covers the transactions the migrations open by hand as well as those of the runner (ADR-0002)
let isTransactionOpen = false;

export const updateOnWeb = vi.fn(async () => undefined);

function getDatabase(): Database {
  if (!database) throw new Error('Test database is not initialized');
  return database;
}

export async function resetTestDatabase(): Promise<void> {
  database?.close();
  isTransactionOpen = false;
  const SQL = await sqlJs;
  database = new SQL.Database();
  database.run('PRAGMA foreign_keys = ON');
  updateOnWeb.mockClear();
}

export const migrationSql: MigrationSql = {
  beginTransaction,
  commitTransaction,
  executeSql,
  querySql,
  rollbackTransaction,
};

/** An empty database brought to the latest schema, or to the one the given steps describe. */
export async function initializeTestDatabase(migrations?: Migration[]): Promise<void> {
  await resetTestDatabase();
  await runMigrations(migrationSql, migrations);
  updateOnWeb.mockClear();
}

export function closeTestDatabase(): void {
  database?.close();
  database = null;
  isTransactionOpen = false;
}

export async function executeSql(sql: string, values?: unknown[], transaction = true) {
  if (transaction && isTransactionOpen) {
    throw new Error('executeSql must pass transaction = false while a transaction is open');
  }

  const db = getDatabase();
  if (values?.length) db.run(sql, values);
  else db.run(sql);

  const lastId = (await querySql<{ id: number }>('SELECT last_insert_rowid() AS id'))[0]?.id;
  return { changes: { changes: db.getRowsModified(), lastId } };
}

export async function querySql<T>(sql: string, values?: unknown[]): Promise<T[]> {
  const statement = getDatabase().prepare(sql, values);
  const rows: T[] = [];

  try {
    while (statement.step()) rows.push(statement.getAsObject<T>());
  } finally {
    statement.free();
  }

  return rows;
}

export async function beginTransaction(): Promise<void> {
  getDatabase().run('BEGIN TRANSACTION');
  isTransactionOpen = true;
}

// A failed COMMIT leaves the transaction open: the rollback that follows it closes it
export async function commitTransaction(): Promise<void> {
  getDatabase().run('COMMIT');
  isTransactionOpen = false;
}

export async function rollbackTransaction(): Promise<void> {
  try {
    getDatabase().run('ROLLBACK');
  } finally {
    isTransactionOpen = false;
  }
}

const transactionRunner = createTransactionRunner({
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  updateOnWeb,
});

export const runInTransaction = transactionRunner.runInTransaction;
