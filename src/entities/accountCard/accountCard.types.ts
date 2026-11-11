import type { Audit } from '@/entities/types';

export interface NewAccountCardRow {
  account_id: number;
  last_digits: string;
}

// A card is added and removed, never edited, so its table has no `updated_at`
export interface AccountCardRow extends NewAccountCardRow, Pick<Audit, 'created_at'> {
  id: number;
}

export type NewAccountCard = {
  accountId: number;
  /** The last four digits of the card number, as the bank notification shows them. */
  lastDigits: string;
};

export type AccountCard = NewAccountCard & {
  id: number;
};
