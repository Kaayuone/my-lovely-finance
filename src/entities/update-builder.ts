type UpdateField = {
  column: string;
  value: unknown;
};

/**
 * Collects the `SET` clauses of an `UPDATE` from the fields that are defined; `null` means nothing
 * changed and the caller skips the statement.
 */
export function buildUpdateAssignments(
  fields: UpdateField[],
): { sets: string[]; values: unknown[] } | null {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const { column, value } of fields) {
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      values.push(value);
    }
  }

  if (sets.length === 0) return null;

  return { sets, values };
}
