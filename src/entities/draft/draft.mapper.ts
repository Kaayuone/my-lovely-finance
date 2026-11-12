import type { NewDraft, NewDraftRow } from './draft.types';

export function newDraftToRow(draft: NewDraft): NewDraftRow {
  return {
    capture_fingerprint: draft.captureFingerprint,
    package_name: draft.packageName,
    posted_at: draft.postedAt,
    title: draft.title,
    text: draft.text,
    big_text: draft.bigText,
    lines: draft.lines,
    template_id: draft.templateId,
    amount_minor: draft.amount?.amountMinor ?? null,
    currency: draft.amount?.currency ?? null,
    direction: draft.direction,
    bank_status: draft.bankStatus,
    payee: draft.payee,
    card_digits: draft.cardDigits,
    balance_minor: draft.balanceMinor,
    occurred_at: draft.occurredAt,
    utc_offset_min: draft.utcOffsetMin,
    state: draft.state,
  };
}
