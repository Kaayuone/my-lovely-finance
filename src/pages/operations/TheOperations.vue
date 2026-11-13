<script setup lang="ts">
import { ArrowLeftRight, Wallet } from '@lucide/vue';
import Button from 'primevue/button';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import ConfirmActionDialog from '@/components/ConfirmActionDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import FabButton from '@/components/FabButton.vue';
import LoadingState from '@/components/LoadingState.vue';
import RowActionsSheet from '@/components/RowActionsSheet.vue';
import AddOperationDialog from '@/features/AddOperationDialog/AddOperationDialog.vue';
import OperationRow from './components/OperationRow.vue';

import { useRouter } from 'vue-router';
import { useLongPress } from '@/composables/useLongPress';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useOperationStore } from '@/stores/operationStore';
import { useAppToast } from '@/services/feedback';

import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { currentOperationTime, operationLocalDay } from '@/utils/operationTime';
import { reloadPinningTop } from '@/utils/scroller';
import { toOperationRowView, withDayHeadings } from './utils';

import type { Operation } from '@/entities/operation/operation.types';
import type { ScrollerHandle } from '@/utils/scroller';
import type { OperationAction, OperationEntry, OperationRowView } from './types';

import {
  DELETE_OPERATION_CONFIRM_HEADER,
  DELETE_OPERATION_CONFIRM_MESSAGE,
} from '@/features/AddOperationDialog/constants';
import { ADJUSTMENT_ACTIONS, OPERATION_ACTIONS } from './constants';

const isOpenOperationDialog = ref(false);
const isOpenRowActions = ref(false);
const isOpenConfirmDelete = ref(false);
const operationToEdit = ref<Operation | null>(null);
const actionRow = ref<OperationRowView | null>(null);
const operationToDelete = ref<Operation | null>(null);
// Raised from the confirmed deletion to the end of the reload after it: no sheet or form opens on
// a list that is about to change
const deleting = ref(false);
// The day «Сегодня» and «Вчера» count from; read again with every load of the list, so a feed left
// open overnight moves on to the new day with its next change
const today = ref(currentDay());

// The scroller reports the end of the list on every frame it stays in view: a portion that failed
// is asked for again only with the next read of the list, not with a toast per frame
let isLoadMoreFailed = false;

const scrollerRef = useTemplateRef<ScrollerHandle<OperationEntry>>('scrollerRef');

const router = useRouter();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const operationStore = useOperationStore();
const { accounts, loading: accountsLoading } = storeToRefs(accountStore);
const { categories } = storeToRefs(categoryStore);
const { operations, loading: operationsLoading } = storeToRefs(operationStore);
const { showOperationError, showOperationSuccess } = useAppToast();

// A press keeps only the id of the operation it began on: a reload may have taken the row off the
// list by the time it fires, so the row is looked up again
const { bindLongPress } = useLongPress<number>({
  isEnabled: id => !deleting.value && findRow(id) !== undefined,
  onLongPress: openRowActions,
});

const accountsById = computed(() => new Map(accounts.value.map(account => [account.id, account])));
const categoriesById = computed(
  () => new Map(categories.value.map(category => [category.id, category])),
);
const operationRows = computed(() =>
  operations.value.map(operation =>
    toOperationRowView(operation, accountsById.value, categoriesById.value),
  ),
);
const operationEntries = computed(() => withDayHeadings(operationRows.value, today.value));
// Which empty state to show depends on the accounts too, so it waits for both lists
const isLoading = computed(() => operationsLoading.value || accountsLoading.value);
const hasActiveAccount = computed(() => accounts.value.some(account => !account.isArchived));
// A balance adjustment has no form to edit it in (A1)
const rowActions = computed(() =>
  actionRow.value?.operation.kind === 'adjustment' ? ADJUSTMENT_ACTIONS : OPERATION_ACTIONS,
);
const rowActionsHeader = computed(() => {
  if (!actionRow.value) return '';

  const { title, amount } = actionRow.value;
  return amount ? `${title} · ${amount}` : title;
});

onMounted(() => {
  void loadAccounts();
  void loadCategories();
  void loadOperations();
});

async function loadAccounts() {
  try {
    await accountStore.loadAccounts();
  } catch (error) {
    showOperationError('loadAccounts', error);
  }
}

async function loadCategories() {
  try {
    await categoryStore.loadCategories();
  } catch (error) {
    showOperationError('loadCategories', error);
  }
}

async function loadOperations() {
  today.value = currentDay();
  isLoadMoreFailed = false;
  try {
    await operationStore.loadOperations();
  } catch (error) {
    showOperationError('loadOperations', error);
  }
}

// The store reads nothing while a load is running or after the last portion
async function loadMoreOperations() {
  if (isLoadMoreFailed) return;

  try {
    await operationStore.loadMoreOperations();
  } catch (error) {
    isLoadMoreFailed = true;
    showOperationError('loadOperations', error);
  }
}

// The reload starts the feed over from its first portion, and keeps it at the top only when it was
// there: an added operation is usually the newest one
async function reloadOperations() {
  await reloadPinningTop(scrollerRef, loadOperations);
}

async function deleteOperation(operation: Operation) {
  if (deleting.value) return;

  deleting.value = true;
  try {
    await operationStore.deleteOperation(operation.id);
    showOperationSuccess('deleteOperation');
    await reloadOperations();
  } catch (error) {
    showOperationError('deleteOperation', error);
  } finally {
    deleting.value = false;
  }
}

function currentDay() {
  return operationLocalDay(currentOperationTime());
}

function findRow(id: number) {
  return operationRows.value.find(row => row.operation.id === id);
}

function openRowActions(id: number) {
  const row = findRow(id);
  if (!row) return;

  actionRow.value = row;
  isOpenRowActions.value = true;
}

function onRowAction(action: OperationAction) {
  const operation = actionRow.value?.operation;
  if (!operation) return;

  switch (action) {
    case 'edit':
      openEditOperationDialog(operation);
      break;
    case 'delete':
      operationToDelete.value = operation;
      isOpenConfirmDelete.value = true;
      break;
  }
}

function onConfirmDelete() {
  const operation = operationToDelete.value;
  if (operation) void deleteOperation(operation);
}

function openAddOperationDialog() {
  operationToEdit.value = null;
  isOpenOperationDialog.value = true;
}

function openEditOperationDialog(operation: Operation) {
  if (deleting.value || operation.kind === 'adjustment') return;

  operationToEdit.value = operation;
  isOpenOperationDialog.value = true;
}

function openAccounts() {
  void router.push({ name: 'accounts' });
}
</script>

<template>
  <!-- An item not measured yet counts as `min-item-size`, so it is the average item: a row is
       52–56 px (70 with a fee note), the separator under it 9 and a day heading 32,
       (54 + 9) / 2 ≈ 32. `emit-update` is what makes the scroller report `scroll-end`, when the
       last item comes into view: the next portion of the feed is read then -->
  <DynamicScroller
    ref="scrollerRef"
    :items="operationEntries"
    :min-item-size="32"
    class="px-column-2 h-full py-2"
    emit-update
    @scroll-end="loadMoreOperations"
  >
    <template #default="{ item: entry, index, active }">
      <!-- The scroller measures this element, and `flow-root` keeps the top margin of a lone line
           inside it: collapsed through, the margin would go unmeasured and the line would touch
           the row under it -->
      <DynamicScrollerItem :item="entry" :active :index class="flow-root">
        <h2 v-if="entry.kind === 'heading'" class="text-muted-color px-2 pt-3 pb-1 text-xs">
          {{ entry.label }}
        </h2>

        <hr v-else-if="entry.kind === 'separator'" class="text-line mt-1 pb-1" />

        <OperationRow
          v-else
          :row="entry.row"
          v-on="bindLongPress(entry.row.operation.id)"
          @click="openEditOperationDialog(entry.row.operation)"
        />
      </DynamicScrollerItem>
    </template>

    <template #empty>
      <LoadingState v-if="isLoading" class="mt-8" />

      <EmptyState
        v-else-if="!hasActiveAccount"
        :icon="Wallet"
        class="mt-2"
        title="Сначала добавьте счёт"
        description="Операции записываются на карту или в наличные."
      >
        <template #action>
          <Button label="К счетам" size="small" @click="openAccounts" />
        </template>
      </EmptyState>

      <EmptyState
        v-else
        :icon="ArrowLeftRight"
        class="mt-2"
        title="Операций пока нет"
        description="Здесь будут доходы, расходы и переводы между счетами."
      >
        <template #action>
          <Button label="Добавить операцию" size="small" @click="openAddOperationDialog" />
        </template>
      </EmptyState>
    </template>

    <template #after>
      <!-- Keeps the last row clear of the floating button, which reaches 59 px above the bottom
           of the list: with the bottom `py-2` the row ends 72 px above it -->
      <div v-if="operationEntries.length" class="h-16" aria-hidden="true" />
    </template>
  </DynamicScroller>

  <!-- The empty state has a button of its own: one button of this name on the screen at a time -->
  <FabButton
    v-if="operations.length && hasActiveAccount"
    label="Добавить операцию"
    @click="openAddOperationDialog"
  />

  <AddOperationDialog
    v-model="isOpenOperationDialog"
    :initial-operation="operationToEdit"
    @added="reloadOperations"
    @updated="reloadOperations"
    @deleted="reloadOperations"
  />

  <RowActionsSheet
    v-model="isOpenRowActions"
    :header="rowActionsHeader"
    :actions="rowActions"
    @select="onRowAction"
  />

  <ConfirmActionDialog
    v-model="isOpenConfirmDelete"
    :header="DELETE_OPERATION_CONFIRM_HEADER"
    :message="DELETE_OPERATION_CONFIRM_MESSAGE"
    @confirm="onConfirmDelete"
  />
</template>
