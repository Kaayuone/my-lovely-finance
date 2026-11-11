import { executeSql, querySql, runInTransaction } from '@/database';
import { newOperationToRow, rowToOperation } from './operation.mapper';
import type {
  NewOperation,
  NewOperationRow,
  Operation,
  OperationRow,
  OperationsPageOptions,
} from './operation.types';

// The order of the columns in the INSERT and the UPDATE below
function rowValues(row: NewOperationRow): unknown[] {
  return [
    row.kind,
    row.account_id,
    row.amount_minor,
    row.to_account_id,
    row.to_amount_minor,
    row.fee_minor,
    row.fee_category_id,
    row.category_id,
    row.payee,
    row.note,
    row.original_amount_minor,
    row.original_currency,
    row.occurred_at,
    row.utc_offset_min,
    row.source,
  ];
}

export async function insertOperation(operation: NewOperation): Promise<number> {
  const row = newOperationToRow(operation);

  return runInTransaction(async () => {
    const result = await executeSql(
      `INSERT INTO operations
        (kind, account_id, amount_minor, to_account_id, to_amount_minor, fee_minor, fee_category_id,
         category_id, payee, note, original_amount_minor, original_currency, occurred_at,
         utc_offset_min, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rowValues(row),
      false,
    );
    const id = result.changes?.lastId;
    if (!id) throw new Error('Failed to get the ID of the new record');
    return id;
  });
}

// Every column is rewritten, so a change of kind clears the fields of the former one
export async function updateOperation(id: number, operation: NewOperation): Promise<void> {
  const row = newOperationToRow(operation);

  await runInTransaction(() =>
    executeSql(
      `UPDATE operations SET
        kind = ?, account_id = ?, amount_minor = ?, to_account_id = ?, to_amount_minor = ?,
        fee_minor = ?, fee_category_id = ?, category_id = ?, payee = ?, note = ?,
        original_amount_minor = ?, original_currency = ?, occurred_at = ?, utc_offset_min = ?,
        source = ?
        WHERE id = ?`,
      [...rowValues(row), id],
      false,
    ),
  );
}

export async function deleteOperation(id: number): Promise<void> {
  await runInTransaction(() => executeSql('DELETE FROM operations WHERE id = ?', [id], false));
}

export async function getOperationsPage(options: OperationsPageOptions): Promise<Operation[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.before) {
    // Same as "earlier than the cursor, or at the same moment with a smaller id". Over all accounts
    // the leading `occurred_at <= ?` makes it a range search on `operations_occurred_at`; with an
    // account SQLite reads the rows of that account through its indexes, cuts them by the cursor and
    // sorts the rest
    conditions.push('(occurred_at <= ? AND (occurred_at < ? OR id < ?))');
    values.push(options.before.occurredAt, options.before.occurredAt, options.before.id);
  }
  if (options.accountId !== undefined) {
    // A transfer belongs to the history of both its accounts
    conditions.push('(account_id = ? OR to_account_id = ?)');
    values.push(options.accountId, options.accountId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await querySql<OperationRow>(
    `SELECT * FROM operations ${where} ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    [...values, options.limit],
  );
  return rows.map(rowToOperation);
}
