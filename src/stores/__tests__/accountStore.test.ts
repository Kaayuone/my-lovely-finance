import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createDeferred } from '@/__tests__/deferred';
import type { Account, AccountBalance, NewAccount } from '@/entities/account/account.types';
import type { AccountCard } from '@/entities/accountCard/accountCard.types';

const accountRepository = vi.hoisted(() => ({
  getAccounts: vi.fn(),
  getAccountBalances: vi.fn(),
  insertAccount: vi.fn(),
  insertAccountWithCards: vi.fn(),
  updateAccount: vi.fn(),
  updateAccountWithCards: vi.fn(),
  setAccountArchived: vi.fn(),
  deleteAccount: vi.fn(),
  countAccountOperations: vi.fn(),
}));
const accountCardRepository = vi.hoisted(() => ({
  getAccountCards: vi.fn(),
  insertAccountCard: vi.fn(),
  deleteAccountCard: vi.fn(),
}));

vi.mock('@/entities/account/account.repository', () => accountRepository);
vi.mock('@/entities/accountCard/accountCard.repository', () => accountCardRepository);

import { useAccountStore } from '@/stores/accountStore';

function newAccount(): NewAccount {
  return {
    name: 'Основной',
    type: 'card',
    currency: 'RUB',
    openingBalanceMinor: 12000,
    bankPackage: 'bank.app',
  };
}

function accounts(): Account[] {
  return [{ ...newAccount(), id: 7, isArchived: false, sortOrder: 1 }];
}

function cards(): AccountCard[] {
  return [{ id: 3, accountId: 7, lastDigits: '0042' }];
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  accountRepository.getAccounts.mockResolvedValue(accounts());
  accountCardRepository.getAccountCards.mockResolvedValue(cards());
  accountRepository.getAccountBalances.mockResolvedValue([
    { accountId: 7, balanceMinor: -450 },
    { accountId: 8, balanceMinor: 0 },
  ]);
});

describe('accountStore', () => {
  it('loads accounts, cards and balances in parallel and waits for all three', async () => {
    const pendingAccounts = createDeferred<Account[]>();
    const pendingCards = createDeferred<AccountCard[]>();
    const pendingBalances = createDeferred<AccountBalance[]>();
    accountRepository.getAccounts.mockReturnValue(pendingAccounts.promise);
    accountCardRepository.getAccountCards.mockReturnValue(pendingCards.promise);
    accountRepository.getAccountBalances.mockReturnValue(pendingBalances.promise);
    const store = useAccountStore();

    const load = store.loadAccounts();
    expect(store.loading).toBe(true);
    expect(accountRepository.getAccounts).toHaveBeenCalledOnce();
    expect(accountCardRepository.getAccountCards).toHaveBeenCalledOnce();
    expect(accountRepository.getAccountBalances).toHaveBeenCalledOnce();

    pendingAccounts.resolve(accounts());
    pendingCards.resolve(cards());
    await Promise.all([pendingAccounts.promise, pendingCards.promise]);
    expect(store.loading).toBe(true);

    pendingBalances.resolve([
      { accountId: 7, balanceMinor: -450 },
      { accountId: 8, balanceMinor: 0 },
    ]);
    await load;

    expect(store.accounts).toEqual(accounts());
    expect(store.cards).toEqual(cards());
    expect(store.balances).toBeInstanceOf(Map);
    expect(store.balances).toEqual(
      new Map([
        [7, -450],
        [8, 0],
      ]),
    );
    expect(store.loading).toBe(false);
  });

  it.each([
    { name: 'accounts', repository: accountRepository.getAccounts },
    { name: 'cards', repository: accountCardRepository.getAccountCards },
    { name: 'balances', repository: accountRepository.getAccountBalances },
  ])(
    'propagates a failed $name load and keeps the previously loaded data',
    async ({ repository }) => {
      const store = useAccountStore();
      await store.loadAccounts();
      const error = new Error('Read failed');
      repository.mockRejectedValueOnce(error);

      await expect(store.loadAccounts()).rejects.toBe(error);

      expect(store.loading).toBe(false);
      expect(store.accounts).toEqual(accounts());
      expect(store.cards).toEqual(cards());
      expect(store.balances).toEqual(
        new Map([
          [7, -450],
          [8, 0],
        ]),
      );
    },
  );

  const actions = [
    {
      name: 'addAccount',
      invoke: (store: ReturnType<typeof useAccountStore>) => store.addAccount(newAccount()),
      repository: accountRepository.insertAccount,
      args: [newAccount()],
      result: 12,
    },
    {
      name: 'addAccountWithCards',
      invoke: (store: ReturnType<typeof useAccountStore>) =>
        store.addAccountWithCards(newAccount(), ['1234', '5678']),
      repository: accountRepository.insertAccountWithCards,
      args: [newAccount(), ['1234', '5678']],
      result: 12,
    },
    {
      name: 'updateAccount',
      invoke: (store: ReturnType<typeof useAccountStore>) =>
        store.updateAccount(7, {
          name: 'Новый',
          openingBalanceMinor: -20,
          bankPackage: null,
          sortOrder: 2,
        }),
      repository: accountRepository.updateAccount,
      args: [7, { name: 'Новый', openingBalanceMinor: -20, bankPackage: null, sortOrder: 2 }],
      result: undefined,
    },
    {
      name: 'updateAccountWithCards',
      invoke: (store: ReturnType<typeof useAccountStore>) =>
        store.updateAccountWithCards(
          7,
          { name: 'Новый', bankPackage: null },
          { add: ['0042', '0043'], removeIds: [3] },
        ),
      repository: accountRepository.updateAccountWithCards,
      args: [7, { name: 'Новый', bankPackage: null }, { add: ['0042', '0043'], removeIds: [3] }],
      result: undefined,
    },
    {
      name: 'setAccountArchived',
      invoke: (store: ReturnType<typeof useAccountStore>) => store.setAccountArchived(7, true),
      repository: accountRepository.setAccountArchived,
      args: [7, true],
      result: undefined,
    },
    {
      name: 'deleteAccount',
      invoke: (store: ReturnType<typeof useAccountStore>) => store.deleteAccount(7),
      repository: accountRepository.deleteAccount,
      args: [7],
      result: undefined,
    },
    {
      name: 'countAccountOperations',
      invoke: (store: ReturnType<typeof useAccountStore>) => store.countAccountOperations(7),
      repository: accountRepository.countAccountOperations,
      args: [7],
      result: 4,
    },
    {
      name: 'addCard',
      invoke: (store: ReturnType<typeof useAccountStore>) =>
        store.addCard({ accountId: 7, lastDigits: '0001' }),
      repository: accountCardRepository.insertAccountCard,
      args: [{ accountId: 7, lastDigits: '0001' }],
      result: 14,
    },
    {
      name: 'removeCard',
      invoke: (store: ReturnType<typeof useAccountStore>) => store.removeCard(3),
      repository: accountCardRepository.deleteAccountCard,
      args: [3],
      result: undefined,
    },
  ];

  it.each(actions)(
    '$name forwards arguments and keeps loaded data without a reload',
    async action => {
      const store = useAccountStore();
      await store.loadAccounts();
      const pending = createDeferred<number | undefined>();
      action.repository.mockReturnValueOnce(pending.promise);

      const write = action.invoke(store);
      expect(store.loading).toBe(true);
      expect(action.repository).toHaveBeenCalledExactlyOnceWith(...action.args);
      pending.resolve(action.result);
      await expect(write).resolves.toBe(action.result);

      expect(store.loading).toBe(false);
      expect(store.accounts).toEqual(accounts());
      expect(store.cards).toEqual(cards());
      expect(store.balances).toEqual(
        new Map([
          [7, -450],
          [8, 0],
        ]),
      );
      expect(accountRepository.getAccounts).toHaveBeenCalledOnce();
      expect(accountCardRepository.getAccountCards).toHaveBeenCalledOnce();
      expect(accountRepository.getAccountBalances).toHaveBeenCalledOnce();
    },
  );

  it.each(actions)('$name propagates repository errors and releases loading', async action => {
    const store = useAccountStore();
    const error = new Error('Write failed');
    action.repository.mockRejectedValueOnce(error);

    await expect(action.invoke(store)).rejects.toBe(error);

    expect(store.loading).toBe(false);
  });
});
