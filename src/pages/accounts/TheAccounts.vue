<script setup lang="ts">
import { Wallet } from '@lucide/vue';
import Button from 'primevue/button';
import ConfirmActionDialog from '@/components/ConfirmActionDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import FabButton from '@/components/FabButton.vue';
import LoadingState from '@/components/LoadingState.vue';
import RowActionsSheet from '@/components/RowActionsSheet.vue';
import AddAccountDialog from '@/features/AddAccountDialog/AddAccountDialog.vue';
import AccountRow from './components/AccountRow.vue';

import { useLongPress } from '@/composables/useLongPress';
import { useAccountStore } from '@/stores/accountStore';
import { useCaptureStore } from '@/stores/captureStore';
import { useAppToast } from '@/services/feedback';

import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';

import type { Account } from '@/entities/account/account.types';
import type { AccountAction } from './constants';

import { ACTIVE_ACCOUNT_ACTIONS, ARCHIVED_ACCOUNT_ACTIONS } from './constants';

const isOpenAccountDialog = ref(false);
const isOpenRowActions = ref(false);
const isOpenConfirmDelete = ref(false);
const isOpenDeleteRefused = ref(false);
const accountToEdit = ref<Account | null>(null);
const actionAccount = ref<Account | null>(null);
const accountToDelete = ref<Account | null>(null);
const isChangingAccount = ref(false);

const accountStore = useAccountStore();
const captureStore = useCaptureStore();
const { accounts, cards, balances, loading } = storeToRefs(accountStore);
const { sources } = storeToRefs(captureStore);
const { showOperationError, showOperationSuccess } = useAppToast();

// A press keeps only the id of the account it began on, and a reload may have replaced the account
// or taken it off the list by the time it fires, so the account is taken from the list again
const { bindLongPress } = useLongPress<number>({
  isEnabled: accountId => !isChangingAccount.value && findAccount(accountId) !== undefined,
  onLongPress: accountId => {
    const account = findAccount(accountId);
    if (account) openRowActions(account);
  },
});

const activeAccounts = computed(() => accounts.value.filter(account => !account.isArchived));
const archivedAccounts = computed(() => accounts.value.filter(account => account.isArchived));
const cardDigitsByAccountId = computed(() => {
  const digitsByAccountId = new Map<number, string[]>();
  for (const card of cards.value) {
    const digits = digitsByAccountId.get(card.accountId) ?? [];
    digits.push(card.lastDigits);
    digitsByAccountId.set(card.accountId, digits);
  }
  return digitsByAccountId;
});
const bankAppLabels = computed(
  () => new Map(sources.value.map(source => [source.packageName, source.label])),
);
const rowActions = computed(() =>
  actionAccount.value?.isArchived ? ARCHIVED_ACCOUNT_ACTIONS : ACTIVE_ACCOUNT_ACTIONS,
);
const deleteMessage = computed(() => `Счёт «${accountToDelete.value?.name}» будет удалён.`);
// The refusal names the way out: an active account goes to the archive, an archived one has none
const deleteRefusedMessage = computed(() =>
  accountToDelete.value?.isArchived
    ? 'У счёта есть операции — удалить его нельзя.'
    : 'У счёта есть операции. Его можно убрать в архив: он пропадёт из выбора, а история останется.',
);
const deleteRefusedLabel = computed(() =>
  accountToDelete.value?.isArchived ? 'Понятно' : 'В архив',
);

onMounted(() => {
  void loadAccounts();
  void loadBankApps();
});

async function loadAccounts() {
  try {
    await accountStore.loadAccounts();
  } catch (error) {
    showOperationError('loadAccounts', error);
  }
}

// Only the names of the bank apps under the rows: the list is shown without them
async function loadBankApps() {
  if (!captureStore.supported) return;

  try {
    await captureStore.loadSources();
  } catch (error) {
    console.error('Failed to load the bank apps of the accounts', error);
  }
}

// A change in flight holds the list until it is read again: the row is still on screen until then,
// and a second command would run on an account that is already changing
async function runAccountChange(change: () => Promise<void>) {
  if (isChangingAccount.value) return;

  isChangingAccount.value = true;
  try {
    await change();
  } finally {
    isChangingAccount.value = false;
  }
}

async function setArchived(account: Account, archived: boolean) {
  const operation = archived ? 'archiveAccount' : 'restoreAccount';
  try {
    await accountStore.setAccountArchived(account.id, archived);
  } catch (error) {
    showOperationError(operation, error);
    return;
  }

  showOperationSuccess(operation);
  await loadAccounts();
}

// Only an account without operations is deleted; one with them is offered the archive (D6)
async function askToDelete(account: Account) {
  let operationsCount: number;
  try {
    operationsCount = await accountStore.countAccountOperations(account.id);
  } catch (error) {
    showOperationError('deleteAccount', error);
    return;
  }

  accountToDelete.value = account;
  if (operationsCount === 0) isOpenConfirmDelete.value = true;
  else isOpenDeleteRefused.value = true;
}

async function deleteAccount(account: Account) {
  try {
    await accountStore.deleteAccount(account.id);
  } catch (error) {
    showOperationError('deleteAccount', error);
    return;
  }

  showOperationSuccess('deleteAccount');
  await loadAccounts();
}

function findAccount(accountId: number) {
  return accounts.value.find(account => account.id === accountId);
}

function openRowActions(account: Account) {
  actionAccount.value = account;
  isOpenRowActions.value = true;
}

function onRowAction(action: AccountAction) {
  const account = actionAccount.value;
  if (!account) return;

  switch (action) {
    case 'edit':
      openEditAccountDialog(account);
      break;
    case 'archive':
      void runAccountChange(() => setArchived(account, true));
      break;
    case 'restore':
      void runAccountChange(() => setArchived(account, false));
      break;
    case 'delete':
      void runAccountChange(() => askToDelete(account));
      break;
  }
}

function onConfirmDelete() {
  const account = accountToDelete.value;
  if (account) void runAccountChange(() => deleteAccount(account));
}

function onDeleteRefusedConfirm() {
  const account = accountToDelete.value;
  if (account && !account.isArchived) void runAccountChange(() => setArchived(account, true));
}

function openAddAccountDialog() {
  accountToEdit.value = null;
  isOpenAccountDialog.value = true;
}

function openEditAccountDialog(account: Account) {
  if (isChangingAccount.value) return;

  accountToEdit.value = account;
  isOpenAccountDialog.value = true;
}
</script>

<template>
  <div class="flex flex-col gap-4 pt-4 pb-20">
    <LoadingState v-if="loading && !accounts.length" class="mt-6" />

    <EmptyState
      v-else-if="!accounts.length"
      :icon="Wallet"
      title="Счетов пока нет"
      description="Здесь будут карты, наличные и их остатки."
    >
      <template #action>
        <Button label="Добавить счёт" size="small" @click="openAddAccountDialog" />
      </template>
    </EmptyState>

    <template v-else>
      <section v-if="activeAccounts.length" class="bg-card divide-line divide-y rounded-xl">
        <AccountRow
          v-for="account in activeAccounts"
          :key="account.id"
          :account
          :card-digits="cardDigitsByAccountId.get(account.id) ?? []"
          :bank-app-label="account.bankPackage ? bankAppLabels.get(account.bankPackage) : null"
          :balance-minor="balances.get(account.id) ?? 0"
          v-on="bindLongPress(account.id)"
          @click="openEditAccountDialog(account)"
        />
      </section>

      <section v-if="archivedAccounts.length" aria-labelledby="accounts-archive-title">
        <h2 id="accounts-archive-title" class="text-muted-color mb-2 px-1 text-sm font-medium">
          Архив
        </h2>

        <div class="bg-card divide-line divide-y rounded-xl">
          <AccountRow
            v-for="account in archivedAccounts"
            :key="account.id"
            :account
            :card-digits="cardDigitsByAccountId.get(account.id) ?? []"
            :bank-app-label="account.bankPackage ? bankAppLabels.get(account.bankPackage) : null"
            :balance-minor="balances.get(account.id) ?? 0"
            muted
            v-on="bindLongPress(account.id)"
            @click="openEditAccountDialog(account)"
          />
        </div>
      </section>
    </template>
  </div>

  <!-- The empty state has a button of its own: one button of this name on the screen at a time -->
  <FabButton v-if="accounts.length" label="Добавить счёт" @click="openAddAccountDialog" />

  <AddAccountDialog
    v-model="isOpenAccountDialog"
    :initial-account="accountToEdit"
    @added="loadAccounts"
    @updated="loadAccounts"
  />

  <RowActionsSheet
    v-model="isOpenRowActions"
    :header="actionAccount?.name ?? ''"
    :actions="rowActions"
    @select="onRowAction"
  />

  <ConfirmActionDialog
    v-model="isOpenConfirmDelete"
    :message="deleteMessage"
    header="Удалить счёт?"
    @confirm="onConfirmDelete"
  />

  <ConfirmActionDialog
    v-model="isOpenDeleteRefused"
    :message="deleteRefusedMessage"
    :confirm-label="deleteRefusedLabel"
    header="Удалить нельзя"
    @confirm="onDeleteRefusedConfirm"
  />
</template>
