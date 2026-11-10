import { MIGRATIONS } from './definitions';
import type { Migration } from './definitions';

export type MigrationSql = {
  beginTransaction: () => Promise<void>;
  commitTransaction: () => Promise<void>;
  executeSql: (sql: string, values?: unknown[], transaction?: boolean) => Promise<unknown>;
  querySql: <T>(sql: string, values?: unknown[]) => Promise<T[]>;
  rollbackTransaction: () => Promise<void>;
};

// The one table that exists outside the migrations: it says which of them have run
const CREATE_SCHEMA_VERSION_TABLE =
  'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)';

async function getCurrentVersion(querySql: MigrationSql['querySql']): Promise<number | null> {
  const rows = await querySql<{ version: number }>('SELECT version FROM schema_version LIMIT 1');
  const row = rows[0];
  if (!row) return null;
  return row.version;
}

/**
 * Runs a migration step as one unit of work: either every statement and the new `schema_version`
 * are committed together, or nothing is. A process killed mid-step leaves the same state — SQLite
 * rolls the open transaction back when the database is reopened — so the next start simply retries
 * the step it never finished.
 *
 * Every statement inside must be passed `transaction = false`. Both adapters read that flag as
 * "wrap this statement in a transaction of your own": the web one (jeep-sqlite) reuses the open
 * transaction and commits it after the very first statement, the native one fails with "Already in
 * transaction" and drops the open one, after which the rest of the step commits statement by
 * statement. Either way the rollback would no longer cover the whole step.
 */
async function withTransaction(ctx: MigrationSql, run: () => Promise<void>): Promise<void> {
  await ctx.beginTransaction();

  try {
    await run();
    await ctx.commitTransaction();
  } catch (error) {
    try {
      await ctx.rollbackTransaction();
    } catch (rollbackError) {
      // A rollback rejects when the adapter has already dropped the transaction itself; the
      // failure that got us here is the one worth reporting
      console.error('Failed to roll back the migration transaction:', rollbackError);
    }
    throw error;
  }
}

async function runMigration(ctx: MigrationSql, migration: Migration): Promise<void> {
  await withTransaction(ctx, async () => {
    for (const statement of migration.statements) {
      await ctx.executeSql(statement, undefined, false);
    }

    await ctx.executeSql('UPDATE schema_version SET version = ?', [migration.version], false);
  });
}

async function initializeSchemaVersion(ctx: MigrationSql): Promise<number> {
  await ctx.executeSql(CREATE_SCHEMA_VERSION_TABLE);

  const currentVersion = await getCurrentVersion(ctx.querySql);
  if (currentVersion !== null) return currentVersion;

  await ctx.executeSql('INSERT INTO schema_version (version) VALUES (?)', [0]);
  return 0;
}

export async function runMigrations(ctx: MigrationSql, migrations = MIGRATIONS): Promise<void> {
  let currentVersion = await initializeSchemaVersion(ctx);

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    await runMigration(ctx, migration);
    currentVersion = migration.version;
  }
}
