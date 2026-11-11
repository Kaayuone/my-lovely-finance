import { describe, expect, it } from 'vitest';
import { buildUpdateAssignments } from '@/entities/update-builder';

describe('buildUpdateAssignments', () => {
  it('keeps the defined fields in order and skips the undefined ones', () => {
    expect(
      buildUpdateAssignments([
        { column: 'name', value: 'Карта' },
        { column: 'note', value: undefined },
        { column: 'closed_at', value: null },
        { column: 'initial_balance_minor', value: 0 },
      ]),
    ).toEqual({
      sets: ['name = ?', 'closed_at = ?', 'initial_balance_minor = ?'],
      values: ['Карта', null, 0],
    });
  });

  it('returns null when no field is defined', () => {
    expect(buildUpdateAssignments([{ column: 'name', value: undefined }])).toBeNull();
    expect(buildUpdateAssignments([])).toBeNull();
  });
});
