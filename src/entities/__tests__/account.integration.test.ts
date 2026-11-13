import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountRepository from '@/entities/account/account.repository';
import * as accountCardRepository from '@/entities/accountCard/accountCard.repository';
import {
  closeTestDatabase,
  executeSql,
  initializeTestDatabase,
  querySql,
  updateOnWeb,
} from '@/database/__tests__/sqliteTestDatabase';
import type { Account, NewAccount } from '@/entities/account/account.types';
import type { AccountCard } from '@/entities/accountCard/accountCard.types';
import type { OperationKind } from '@/types/finance';

vi.mock('@/database', async () => import('@/database/__tests__/sqliteTestDatabase'));

type OperationRow = {
  kind: OperationKind;
  account_id: number;
  amount_minor: number;
  to_account_id?: number;
  to_amount_minor?: number;
  fee_minor?: number;
  fee_category_id?: number;
  category_id?: number;
};

// 11 November 2026, 12:00 in Minsk
const OCCURRED_AT = 1_794_387_600_000;
const MINSK_OFFSET_MIN = 180;

const BYN_CARD: NewAccount = {
  name: 'Карта BYN',
  type: 'card',
  currency: 'BYN',
  openingBalanceMinor: 10_000,
  bankPackage: 'com.example.bank',
};

const USD_CARD: NewAccount = {
  name: 'Карта USD',
  type: 'card',
  currency: 'USD',
  openingBalanceMinor: 500,
  bankPackage: 'com.example.bank',
};

const RUB_CASH: NewAccount = {
  name: 'Наличные RUB',
  type: 'cash',
  currency: 'RUB',
  openingBalanceMinor: 75_000,
  bankPackage: null,
};

// Straight into the table: the balances are checked against rows no repository shaped
async function insertOperation(row: OperationRow): Promise<void> {
  const fields = { occurred_at: OCCURRED_AT, utc_offset_min: MINSK_OFFSET_MIN, ...row };
  const columns = Object.keys(fields);
  await executeSql(
    `INSERT INTO operations (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(fields),
  );
}

async function getCategoryId(code: string): Promise<number> {
  const [row] = await querySql<{ id: number }>('SELECT id FROM categories WHERE code = ?', [code]);
  if (!row) throw new Error(`Category ${code} not found`);
  return row.id;
}

async function getAccount(id: number): Promise<Account | undefined> {
  return (await accountRepository.getAccounts()).find(account => account.id === id);
}

async function getAccountIds(): Promise<number[]> {
  return (await accountRepository.getAccounts()).map(account => account.id);
}

async function getCardDigits(accountId: number): Promise<string[]> {
  return (await accountCardRepository.getAccountCards())
    .filter(card => card.accountId === accountId)
    .map(card => card.lastDigits);
}

async function getCard(accountId: number, lastDigits: string): Promise<AccountCard> {
  const card = (await accountCardRepository.getAccountCards()).find(
    candidate => candidate.accountId === accountId && candidate.lastDigits === lastDigits,
  );
  if (!card) throw new Error(`Card ${lastDigits} of account ${accountId} not found`);
  return card;
}

describe('account repositories with SQLite', () => {
  // Not passed directly: Vitest would hand it the test context as the list of migrations
  beforeEach(() => initializeTestDatabase());
  afterEach(closeTestDatabase);

  it('reads accounts back through the mapper, each new one at the end of the list', async () => {
    const bynId = await accountRepository.insertAccount(BYN_CARD);
    const cashId = await accountRepository.insertAccount(RUB_CASH);

    expect(await accountRepository.getAccounts()).toEqual([
      { ...BYN_CARD, id: bynId, isArchived: false, sortOrder: 1 },
      { ...RUB_CASH, id: cashId, isArchived: false, sortOrder: 2 },
    ]);
  });

  it('changes only the fields passed and skips the undefined ones', async () => {
    const id = await accountRepository.insertAccount(BYN_CARD);
    const otherId = await accountRepository.insertAccount(USD_CARD);

    await accountRepository.updateAccount(id, {
      name: 'Зарплатная',
      openingBalanceMinor: undefined,
      bankPackage: undefined,
    });
    expect(await getAccount(id)).toEqual({
      ...BYN_CARD,
      id,
      name: 'Зарплатная',
      isArchived: false,
      sortOrder: 1,
    });

    await accountRepository.updateAccount(id, {
      openingBalanceMinor: -2_500,
      bankPackage: null,
      sortOrder: 7,
    });
    expect(await getAccount(id)).toEqual({
      ...BYN_CARD,
      id,
      name: 'Зарплатная',
      openingBalanceMinor: -2_500,
      bankPackage: null,
      isArchived: false,
      sortOrder: 7,
    });
    expect(await getAccount(otherId)).toEqual({
      ...USD_CARD,
      id: otherId,
      isArchived: false,
      sortOrder: 2,
    });

    // Nothing to change opens no transaction, so nothing is saved
    updateOnWeb.mockClear();
    await accountRepository.updateAccount(id, { name: undefined });
    expect(updateOnWeb).not.toHaveBeenCalled();
  });

  it('moves an account to the archive and back, the archived listed last', async () => {
    const bynId = await accountRepository.insertAccount(BYN_CARD);
    const usdId = await accountRepository.insertAccount(USD_CARD);

    await accountRepository.setAccountArchived(bynId, true);
    const cashId = await accountRepository.insertAccount(RUB_CASH);

    expect(await accountRepository.getAccounts()).toEqual([
      expect.objectContaining({ id: usdId, isArchived: false, sortOrder: 2 }),
      expect.objectContaining({ id: cashId, isArchived: false, sortOrder: 3 }),
      expect.objectContaining({ id: bynId, isArchived: true, sortOrder: 1 }),
    ]);

    await accountRepository.setAccountArchived(bynId, false);
    expect(await getAccount(bynId)).toEqual(expect.objectContaining({ isArchived: false }));
    expect(await getAccountIds()).toEqual([bynId, usdId, cashId]);
  });

  it('deletes an account without operations together with its cards', async () => {
    const keptId = await accountRepository.insertAccount(BYN_CARD);
    const emptyId = await accountRepository.insertAccount(USD_CARD);
    const keptCardId = await accountCardRepository.insertAccountCard({
      accountId: keptId,
      lastDigits: '1111',
    });
    await accountCardRepository.insertAccountCard({ accountId: emptyId, lastDigits: '2222' });
    await accountCardRepository.insertAccountCard({ accountId: emptyId, lastDigits: '3333' });

    await accountRepository.deleteAccount(emptyId);

    expect(await getAccountIds()).toEqual([keptId]);
    expect(await accountCardRepository.getAccountCards()).toEqual([
      { id: keptCardId, accountId: keptId, lastDigits: '1111' },
    ]);
  });

  it('refuses to delete an account a transfer leaves or reaches and counts both sides', async () => {
    const sourceId = await accountRepository.insertAccount(BYN_CARD);
    const receiverId = await accountRepository.insertAccount(USD_CARD);
    const emptyId = await accountRepository.insertAccount(RUB_CASH);
    await insertOperation({
      kind: 'transfer',
      account_id: sourceId,
      amount_minor: -3_000,
      to_account_id: receiverId,
      to_amount_minor: 1_000,
    });

    expect(await accountRepository.countAccountOperations(sourceId)).toBe(1);
    expect(await accountRepository.countAccountOperations(receiverId)).toBe(1);
    expect(await accountRepository.countAccountOperations(emptyId)).toBe(0);

    await expect(accountRepository.deleteAccount(sourceId)).rejects.toThrow(
      'FOREIGN KEY constraint failed',
    );
    await expect(accountRepository.deleteAccount(receiverId)).rejects.toThrow(
      'FOREIGN KEY constraint failed',
    );
    expect(await getAccountIds()).toEqual([sourceId, receiverId, emptyId]);

    // The refused deletes rolled back and released the queue
    await accountRepository.deleteAccount(emptyId);
    expect(await getAccountIds()).toEqual([sourceId, receiverId]);

    await insertOperation({ kind: 'expense', account_id: receiverId, amount_minor: -300 });
    expect(await accountRepository.countAccountOperations(receiverId)).toBe(2);
  });

  it('computes each balance from the opening balance and every operation', async () => {
    const bynId = await accountRepository.insertAccount(BYN_CARD);
    const usdId = await accountRepository.insertAccount(USD_CARD);
    const cashId = await accountRepository.insertAccount(RUB_CASH);
    const groceriesId = await getCategoryId('food.groceries');
    const salaryId = await getCategoryId('salary');
    const feesId = await getCategoryId('finance.fees');

    await insertOperation({
      kind: 'expense',
      account_id: bynId,
      amount_minor: -2_550,
      category_id: groceriesId,
    });
    await insertOperation({
      kind: 'income',
      account_id: bynId,
      amount_minor: 150_000,
      category_id: salaryId,
    });
    // A refund is an expense with a plus
    await insertOperation({
      kind: 'expense',
      account_id: bynId,
      amount_minor: 1_200,
      category_id: groceriesId,
    });
    await insertOperation({
      kind: 'transfer',
      account_id: bynId,
      amount_minor: -30_000,
      to_account_id: usdId,
      to_amount_minor: 1_000,
      fee_minor: -150,
      fee_category_id: feesId,
    });
    await insertOperation({ kind: 'adjustment', account_id: bynId, amount_minor: -33 });
    await insertOperation({
      kind: 'transfer',
      account_id: usdId,
      amount_minor: -200,
      to_account_id: bynId,
      to_amount_minor: 600,
    });
    await insertOperation({ kind: 'adjustment', account_id: usdId, amount_minor: 7 });

    const balances = await accountRepository.getAccountBalances();

    expect(balances.toSorted((a, b) => a.accountId - b.accountId)).toEqual([
      // 10_000 − 2_550 + 150_000 + 1_200 − 30_000 − 150 − 33 + 600
      { accountId: bynId, balanceMinor: 129_067 },
      // 500 + 1_000 − 200 + 7
      { accountId: usdId, balanceMinor: 1_307 },
      { accountId: cashId, balanceMinor: 75_000 },
    ]);
  });

  it('keeps several cards on an account and finds every account a card serves', async () => {
    const bynId = await accountRepository.insertAccount(BYN_CARD);
    const usdId = await accountRepository.insertAccount(USD_CARD);
    const sharedOnBynId = await accountCardRepository.insertAccountCard({
      accountId: bynId,
      lastDigits: '1234',
    });
    const ownId = await accountCardRepository.insertAccountCard({
      accountId: bynId,
      lastDigits: '5678',
    });
    const sharedOnUsdId = await accountCardRepository.insertAccountCard({
      accountId: usdId,
      lastDigits: '1234',
    });

    expect(await accountCardRepository.getAccountCards()).toEqual([
      { id: sharedOnBynId, accountId: bynId, lastDigits: '1234' },
      { id: ownId, accountId: bynId, lastDigits: '5678' },
      { id: sharedOnUsdId, accountId: usdId, lastDigits: '1234' },
    ]);
    expect(await accountCardRepository.findAccountIdsByLastDigits('1234')).toEqual([bynId, usdId]);
    expect(await accountCardRepository.findAccountIdsByLastDigits('5678')).toEqual([bynId]);
    expect(await accountCardRepository.findAccountIdsByLastDigits('0000')).toEqual([]);
    // Every write went through the transaction queue, which saves the web store after a commit
    expect(updateOnWeb).toHaveBeenCalledTimes(5);
  });

  it('refuses the same card twice on one account and deletes a card', async () => {
    const bynId = await accountRepository.insertAccount(BYN_CARD);
    const usdId = await accountRepository.insertAccount(USD_CARD);
    const cardId = await accountCardRepository.insertAccountCard({
      accountId: bynId,
      lastDigits: '1234',
    });
    await accountCardRepository.insertAccountCard({ accountId: usdId, lastDigits: '1234' });

    await expect(
      accountCardRepository.insertAccountCard({ accountId: bynId, lastDigits: '1234' }),
    ).rejects.toThrow('UNIQUE constraint failed');

    await accountCardRepository.deleteAccountCard(cardId);
    expect(await accountCardRepository.findAccountIdsByLastDigits('1234')).toEqual([usdId]);
  });

  it('creates an account with its cards in one transaction, or with none', async () => {
    const bynId = await accountRepository.insertAccountWithCards(BYN_CARD, ['1234', '5678']);
    expect(updateOnWeb).toHaveBeenCalledOnce();
    const cashId = await accountRepository.insertAccountWithCards(RUB_CASH, []);
    expect(updateOnWeb).toHaveBeenCalledTimes(2);

    expect(await accountRepository.getAccounts()).toEqual([
      { ...BYN_CARD, id: bynId, isArchived: false, sortOrder: 1 },
      { ...RUB_CASH, id: cashId, isArchived: false, sortOrder: 2 },
    ]);
    expect(await getCardDigits(bynId)).toEqual(['1234', '5678']);
    expect(await getCardDigits(cashId)).toEqual([]);
  });

  it.each([
    { refusal: 'a card that is not four digits', lastDigits: ['1234', '12a4'], error: 'CHECK' },
    { refusal: 'the same card twice', lastDigits: ['1234', '1234'], error: 'UNIQUE' },
  ])('stores neither the account nor its cards on $refusal', async ({ lastDigits, error }) => {
    await expect(accountRepository.insertAccountWithCards(BYN_CARD, lastDigits)).rejects.toThrow(
      `${error} constraint failed`,
    );

    expect(await accountRepository.getAccounts()).toEqual([]);
    expect(await accountCardRepository.getAccountCards()).toEqual([]);
    expect(updateOnWeb).not.toHaveBeenCalled();

    // The rollback released the queue, and the account it dropped took no place in the list
    const id = await accountRepository.insertAccountWithCards(BYN_CARD, ['1234']);
    expect(await accountRepository.getAccounts()).toEqual([
      { ...BYN_CARD, id, isArchived: false, sortOrder: 1 },
    ]);
    expect(await getCardDigits(id)).toEqual(['1234']);
  });

  it('changes the fields and the cards of an account in one transaction', async () => {
    const id = await accountRepository.insertAccountWithCards(BYN_CARD, ['1234', '5678']);
    const otherId = await accountRepository.insertAccountWithCards(USD_CARD, ['1234']);
    const removedIds = [(await getCard(id, '1234')).id, (await getCard(id, '5678')).id];
    updateOnWeb.mockClear();

    // The digits of a removed card come back in the same save
    await accountRepository.updateAccountWithCards(
      id,
      { name: 'Зарплатная', bankPackage: null },
      { add: ['1234', '9999'], removeIds: removedIds },
    );

    expect(updateOnWeb).toHaveBeenCalledOnce();
    expect(await getAccount(id)).toEqual({
      ...BYN_CARD,
      id,
      name: 'Зарплатная',
      bankPackage: null,
      isArchived: false,
      sortOrder: 1,
    });
    expect(await getCardDigits(id)).toEqual(['1234', '9999']);
    expect(await getCardDigits(otherId)).toEqual(['1234']);

    // No field to change runs no UPDATE, and the cards still change
    await accountRepository.updateAccountWithCards(id, {}, { add: ['0000'], removeIds: [] });

    expect(updateOnWeb).toHaveBeenCalledTimes(2);
    expect(await getAccount(id)).toEqual(expect.objectContaining({ name: 'Зарплатная' }));
    expect(await getCardDigits(id)).toEqual(['1234', '9999', '0000']);
  });

  it('leaves a card of another account in place when its id comes to be removed', async () => {
    const id = await accountRepository.insertAccountWithCards(BYN_CARD, ['1111']);
    const otherId = await accountRepository.insertAccountWithCards(USD_CARD, ['2222']);
    const otherCard = await getCard(otherId, '2222');

    await accountRepository.updateAccountWithCards(id, {}, { add: [], removeIds: [otherCard.id] });

    expect(await getCardDigits(id)).toEqual(['1111']);
    expect(await getCardDigits(otherId)).toEqual(['2222']);
  });

  it('rolls the fields and the removed cards back when an added card is refused', async () => {
    const id = await accountRepository.insertAccountWithCards(BYN_CARD, ['1234', '5678']);
    const cards = await accountCardRepository.getAccountCards();
    const removed = await getCard(id, '1234');
    updateOnWeb.mockClear();

    await expect(
      accountRepository.updateAccountWithCards(
        id,
        { name: 'Зарплатная', openingBalanceMinor: 0 },
        { add: ['0000', '5678'], removeIds: [removed.id] },
      ),
    ).rejects.toThrow('UNIQUE constraint failed');

    expect(updateOnWeb).not.toHaveBeenCalled();
    expect(await getAccount(id)).toEqual({ ...BYN_CARD, id, isArchived: false, sortOrder: 1 });
    expect(await accountCardRepository.getAccountCards()).toEqual(cards);
  });
});
