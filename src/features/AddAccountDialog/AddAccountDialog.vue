<script setup lang="ts">
import FormDrawer from '@/components/FormDrawer.vue';
import AddAccountForm from './AddAccountForm.vue';

import { useAccountStore } from '@/stores/accountStore';
import { useAppToast } from '@/services/feedback';
import { useFormValidation } from '@/services/validation';

import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { accountToForm, toAccountUpdate, toNewAccount } from './utils';

import type { Account } from '@/entities/account/account.types';
import type { AccountForm } from './types';

import { GET_INITIAL_VALUE } from './constants';
import { getAccountFormSchema } from './validation';

const { modelValue, initialAccount } = defineProps<{
  modelValue: boolean;
  initialAccount?: Account | null;
}>();

const emit = defineEmits<{
  'update:model-value': [value: boolean];
  added: [id: number];
  updated: [];
}>();

const form = ref<AccountForm>(GET_INITIAL_VALUE());
const saving = ref(false);

const accountStore = useAccountStore();
const { cards } = storeToRefs(accountStore);
const { showOperationError, showOperationSuccess } = useAppToast();
const { errors, validate, resetValidation } = useFormValidation(
  () => getAccountFormSchema(form.value),
  form,
);

const visible = computed({
  get: () => modelValue,
  set: value => emit('update:model-value', value),
});
const isEditMode = computed(() => Boolean(initialAccount));
const header = computed(() => (isEditMode.value ? 'Счёт' : 'Новый счёт'));

watch(
  () => modelValue,
  open => {
    if (!open) return;

    form.value = initialAccount ? accountToForm(initialAccount, cards.value) : GET_INITIAL_VALUE();
    resetValidation();
  },
);

// The account and its cards are written in one transaction, so a failed save leaves nothing behind
// and the form stays open to try again
async function saveAccount() {
  // A second tap while the first one is still saving would insert the account twice
  if (saving.value) return;
  if (!validate()) return;

  saving.value = true;
  try {
    if (initialAccount) {
      const update = toAccountUpdate(form.value, initialAccount, cards.value);
      await accountStore.updateAccountWithCards(initialAccount.id, update.changes, update.cards);

      showOperationSuccess('updateAccount');
      emit('updated');
      visible.value = false;
      return;
    }

    const { account, lastDigits } = toNewAccount(form.value);
    const id = await accountStore.addAccountWithCards(account, lastDigits);

    showOperationSuccess('createAccount');
    emit('added', id);
    visible.value = false;
  } catch (error) {
    showOperationError(initialAccount ? 'updateAccount' : 'createAccount', error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <FormDrawer v-model="visible" :header :saving @save="saveAccount">
    <AddAccountForm
      v-if="visible"
      v-model="form"
      :type-and-currency-disabled="isEditMode"
      :errors
    />
  </FormDrawer>
</template>
