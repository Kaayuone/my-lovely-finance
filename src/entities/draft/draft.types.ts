import type { Audit } from '@/entities/types';
import type { MoneyDirection, OperationStatus } from '@/services/notificationParsing';
import type { DraftState, Money } from '@/types/finance';

export interface NewDraftRow {
  capture_fingerprint: string;
  package_name: string;
  posted_at: number;
  title: string | null;
  text: string | null;
  big_text: string | null;
  lines: string | null;
  template_id: string | null;
  amount_minor: number | null;
  currency: string | null;
  direction: MoneyDirection | null;
  bank_status: OperationStatus | null;
  payee: string | null;
  card_digits: string | null;
  balance_minor: number | null;
  occurred_at: number;
  utc_offset_min: number;
  state: DraftState;
}

export interface DraftRow extends NewDraftRow, Audit {
  id: number;
}

// What a captured notification told, as the parser read it (ADR-0007), with the raw texts kept for a
// newer template and for teaching one. Everything the parser did not find is null
export type NewDraft = {
  // The capture queue row it came from: the same row taken twice stays one draft (ADR-0003)
  captureFingerprint: string;
  packageName: string;
  postedAt: number;
  title: string | null;
  text: string | null;
  bigText: string | null;
  lines: string | null;
  // null — the general parser read it, or nothing did
  templateId: string | null;
  // Positive minor units: the sign is `direction`. null — no amount the parser could trust
  amount: Money | null;
  direction: MoneyDirection | null;
  bankStatus: OperationStatus | null;
  payee: string | null;
  cardDigits: string | null;
  // Signed, in the currency of the amount
  balanceMinor: number | null;
  occurredAt: number;
  utcOffsetMin: number;
  state: DraftState;
};
