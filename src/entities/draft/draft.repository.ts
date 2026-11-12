import { executeSql, runInTransaction } from '@/database';
import { newDraftToRow } from './draft.mapper';
import type { NewDraft, NewDraftRow } from './draft.types';

// The order of the columns in the INSERT below
function rowValues(row: NewDraftRow): unknown[] {
  return [
    row.capture_fingerprint,
    row.package_name,
    row.posted_at,
    row.title,
    row.text,
    row.big_text,
    row.lines,
    row.template_id,
    row.amount_minor,
    row.currency,
    row.direction,
    row.bank_status,
    row.payee,
    row.card_digits,
    row.balance_minor,
    row.occurred_at,
    row.utc_offset_min,
    row.state,
  ];
}

/**
 * Writes the drafts of one batch of the capture queue in one transaction and answers how many of
 * them are new. A draft of a queue row taken before — the app died before it acknowledged the batch
 * — is dropped by its fingerprint. Not `INSERT OR IGNORE`: it drops a row that breaks a CHECK just
 * as silently, and a lost draft is lost money; such a row rolls the whole batch back instead.
 */
export async function insertDrafts(drafts: readonly NewDraft[]): Promise<number> {
  const rows = drafts.map(newDraftToRow);

  return runInTransaction(async () => {
    let inserted = 0;
    for (const row of rows) {
      const result = await executeSql(
        `INSERT INTO drafts
          (capture_fingerprint, package_name, posted_at, title, text, big_text, lines, template_id,
           amount_minor, currency, direction, bank_status, payee, card_digits, balance_minor,
           occurred_at, utc_offset_min, state)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (capture_fingerprint) DO NOTHING`,
        rowValues(row),
        false,
      );
      inserted += result.changes?.changes ?? 0;
    }
    return inserted;
  });
}
