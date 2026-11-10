import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIGRATIONS, runMigrations } from '@/database/migrations';
import {
  closeTestDatabase,
  initializeTestDatabase,
  migrationSql,
  querySql,
  resetTestDatabase,
} from '@/database/__tests__/sqliteTestDatabase';
import type { Migration } from '@/database/migrations';

const NOTES_V1: Migration = {
  version: 1,
  statements: ['CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)'],
};
const NOTES_V2: Migration = {
  version: 2,
  statements: ['ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0'],
};

async function schemaVersion(): Promise<number | undefined> {
  const rows = await querySql<{ version: number }>('SELECT version FROM schema_version');
  return rows[0]?.version;
}

async function columnsOf(table: string): Promise<string[]> {
  const rows = await querySql<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map(row => row.name);
}

afterEach(() => {
  closeTestDatabase();
});

describe('runMigrations', () => {
  it('brings an empty database to the latest version of the steps', async () => {
    await initializeTestDatabase([NOTES_V1, NOTES_V2]);

    expect(await schemaVersion()).toBe(2);
    expect(await columnsOf('notes')).toEqual(['id', 'text', 'pinned']);
  });

  it('keeps a single version row across restarts', async () => {
    await initializeTestDatabase([NOTES_V1]);
    await runMigrations(migrationSql, [NOTES_V1]);

    const rows = await querySql<{ version: number }>('SELECT version FROM schema_version');
    expect(rows).toEqual([{ version: 1 }]);
  });

  it('runs only the steps an older database has not seen', async () => {
    await initializeTestDatabase([NOTES_V1]);
    const executeSpy = vi.spyOn(migrationSql, 'executeSql');

    await runMigrations(migrationSql, [NOTES_V1, NOTES_V2]);

    const statements = executeSpy.mock.calls.map(([sql]) => sql);
    expect(statements).not.toContain(NOTES_V1.statements[0]);
    expect(statements).toContain(NOTES_V2.statements[0]);
    expect(await schemaVersion()).toBe(2);
    executeSpy.mockRestore();
  });

  // A step is one unit of work: a failure halfway leaves neither its first statement nor its version
  it('rolls a failed step back whole and keeps the version of the last good one', async () => {
    const broken: Migration = {
      version: 2,
      statements: [
        'ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0',
        'INSERT INTO missing_table (id) VALUES (1)',
      ],
    };
    await initializeTestDatabase([NOTES_V1]);

    await expect(runMigrations(migrationSql, [NOTES_V1, broken])).rejects.toThrow(
      /no such table: missing_table/,
    );

    expect(await schemaVersion()).toBe(1);
    expect(await columnsOf('notes')).toEqual(['id', 'text']);
  });

  it('creates the version table on a database that has none', async () => {
    await resetTestDatabase();

    await runMigrations(migrationSql, []);

    expect(await schemaVersion()).toBe(0);
  });
});

describe('MIGRATIONS', () => {
  it('numbers the steps 1, 2, 3… without gaps or repeats', () => {
    expect(MIGRATIONS.map(migration => migration.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1),
    );
  });

  it('applies every step to an empty database', async () => {
    await initializeTestDatabase();

    expect(await schemaVersion()).toBe(MIGRATIONS.length);
  });
});
