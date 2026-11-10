import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from '@/database/migrations/definitions';

/** Every step as the runner would execute it today, one version after another. */
function renderMigrations(): string {
  const versions = MIGRATIONS.map(({ version, statements }) =>
    [`-- version ${version}`, ...statements.map(statement => `${statement};`)].join('\n\n'),
  );
  return `${versions.join('\n\n')}\n`;
}

describe('migration SQL', () => {
  // A migration that has shipped already ran on real databases and has to keep doing exactly what it
  // did there: only the version that has not shipped yet, or a new one, may change its part of the
  // snapshot (docs/workflows/migrations.md)
  it('keeps the SQL of every migration equal to the committed snapshot', async () => {
    await expect(renderMigrations()).toMatchFileSnapshot('./__snapshots__/migrations.sql');
  });
});
