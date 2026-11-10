export type Migration = {
  version: number;
  statements: string[];
};

/**
 * The whole schema of the database, step by step: a fresh install runs every step from the first,
 * an older database runs the ones it has not seen (ADR-0002). Append-only — a step that has reached
 * a user's phone is never edited; a fix is a new step (docs/workflows/migrations.md).
 */
export const MIGRATIONS: Migration[] = [];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;
