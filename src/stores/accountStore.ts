import { defineStore } from 'pinia';
import { ref } from 'vue';

import * as accountRepository from '@/entities/account/account.repository';
import * as accountCardRepository from '@/entities/accountCard/accountCard.repository';

import type { Account, NewAccount } from '@/entities/account/account.types';
import type { AccountCard, NewAccountCard } from '@/entities/accountCard/accountCard.types';

export const useAccountStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([]);
  const cards = ref<AccountCard[]>([]);
  const balances = ref(new Map<number, number>());
  const loading = ref(false);

  async function loadAccounts() {
    loading.value = true;
    try {
      const [loadedAccounts, loadedCards, loadedBalances] = await Promise.all([
        accountRepository.getAccounts(),
        accountCardRepository.getAccountCards(),
        accountRepository.getAccountBalances(),
      ]);
      accounts.value = loadedAccounts;
      cards.value = loadedCards;
      balances.value = new Map(
        loadedBalances.map(balance => [balance.accountId, balance.balanceMinor]),
      );
    } finally {
      loading.value = false;
    }
  }

  async function addAccount(account: NewAccount) {
    loading.value = true;
    try {
      return await accountRepository.insertAccount(account);
    } finally {
      loading.value = false;
    }
  }

  async function updateAccount(
    id: number,
    changes: Partial<Pick<Account, 'name' | 'openingBalanceMinor' | 'bankPackage' | 'sortOrder'>>,
  ) {
    loading.value = true;
    try {
      await accountRepository.updateAccount(id, changes);
    } finally {
      loading.value = false;
    }
  }

  async function setAccountArchived(id: number, archived: boolean) {
    loading.value = true;
    try {
      await accountRepository.setAccountArchived(id, archived);
    } finally {
      loading.value = false;
    }
  }

  async function deleteAccount(id: number) {
    loading.value = true;
    try {
      await accountRepository.deleteAccount(id);
    } finally {
      loading.value = false;
    }
  }

  async function addCard(card: NewAccountCard) {
    loading.value = true;
    try {
      return await accountCardRepository.insertAccountCard(card);
    } finally {
      loading.value = false;
    }
  }

  async function removeCard(id: number) {
    loading.value = true;
    try {
      await accountCardRepository.deleteAccountCard(id);
    } finally {
      loading.value = false;
    }
  }

  return {
    accounts,
    cards,
    balances,
    loading,
    loadAccounts,
    addAccount,
    updateAccount,
    setAccountArchived,
    deleteAccount,
    addCard,
    removeCard,
  };
});
