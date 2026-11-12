export type AccountType = 'card' | 'cash';
export type CategoryKind = 'expense' | 'income';
export type OperationKind = 'expense' | 'income' | 'transfer' | 'adjustment';
export type OperationSource = 'manual' | 'notification';
// A draft waits for the person, became an operation or was put aside — a declined one from the start
export type DraftState = 'pending' | 'confirmed' | 'dismissed';
// An amount never travels without its currency (ADR-0005)
export type Money = { amountMinor: number; currency: string };
// The moment in ms UTC and the zone offset at that moment, minutes east of UTC
export type OperationTime = { occurredAt: number; utcOffsetMin: number };
