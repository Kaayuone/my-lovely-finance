<script setup lang="ts">
import ConfirmActionDialog from '@/components/ConfirmActionDialog.vue';
import FormDrawer from '@/components/FormDrawer.vue';
import AddOperationForm from './components/AddOperationForm.vue';

import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useOperationStore } from '@/stores/operationStore';
import { useAppToast } from '@/services/feedback';
import { useFormValidation } from '@/services/validation';

import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { newOperationForm, operationToForm, toNewOperation } from './utils';
import { getOperationFormSchema } from './validation';

import type { Operation } from '@/entities/operation/operation.types';
import type { OperationForm, OperationFormContext } from './types';

import { FEE_CATEGORY_CODE } from '@/constants/category';
import { DELETE_OPERATION_CONFIRM_HEADER, DELETE_OPERATION_CONFIRM_MESSAGE } from './constants';

// The accounts and categories are loaded by the page that hosts the dialog; the dialog only reads
const { modelValue, initialOperation } = defineProps<{
  modelValue: boolean;
  initialOperation?: Operation | null;
}>();

const emit = defineEmits<{
  'update:model-value': [value: boolean];
  added: [id: number];
  updated: [];
  deleted: [];
}>();

const form = ref<OperationForm>(newOperationForm([]));
const isOpenConfirmDelete = ref(false);
// One write at a time: a second tap on ✓ or on the confirmation would add or delete twice
const saving = ref(false);

const { accounts } = storeToRefs(useAccountStore());
const { categories } = storeToRefs(useCategoryStore());
const operationStore = useOperationStore();
const { showOperationError, showOperationSuccess } = useAppToast();

const visible = computed({
  get: () => modelValue,
  set: value => emit('update:model-value', value),
});

const header = computed(() => (initialOperation ? 'Операция' : 'Новая операция'));
const context = computed<OperationFormContext>(() => ({
  accountsById: new Map(accounts.value.map(account => [account.id, account])),
  feeCategoryId: categories.value.find(category => category.code === FEE_CATEGORY_CODE)?.id ?? null,
  original: initialOperation ?? null,
}));
const { errors, validate, resetValidation } = useFormValidation(
  () => getOperationFormSchema(form.value, context.value),
  form,
);

watch(
  () => modelValue,
  open => {
    if (!open) return;

    isOpenConfirmDelete.value = false;
    resetValidation();
    try {
      form.value = initialOperation
        ? operationToForm(initialOperation, context.value.accountsById)
        : newOperationForm(accounts.value);
    } catch (error) {
      // A form left from the previous opening would be saved over this operation
      showOperationError('loadOperations', error);
      visible.value = false;
    }
  },
);

async function saveOperation() {
  if (saving.value) return;
  if (!validate()) return;

  saving.value = true;
  try {
    const operation = toNewOperation(form.value, context.value);
    if (initialOperation) {
      await operationStore.updateOperation(initialOperation.id, operation);
      showOperationSuccess('updateOperation');
      emit('updated');
      visible.value = false;
      return;
    }

    const id = await operationStore.addOperation(operation);
    showOperationSuccess('createOperation');
    emit('added', id);
    visible.value = false;
  } catch (error) {
    showOperationError(initialOperation ? 'updateOperation' : 'createOperation', error);
  } finally {
    saving.value = false;
  }
}

async function deleteOperation() {
  if (saving.value || !initialOperation) return;

  saving.value = true;
  try {
    await operationStore.deleteOperation(initialOperation.id);
    showOperationSuccess('deleteOperation');
    emit('deleted');
    visible.value = false;
  } catch (error) {
    showOperationError('deleteOperation', error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <FormDrawer
    v-model="visible"
    :show-delete="Boolean(initialOperation)"
    :header
    :saving
    @save="saveOperation"
    @delete="isOpenConfirmDelete = true"
  >
    <AddOperationForm v-model="form" :context :errors />
  </FormDrawer>

  <ConfirmActionDialog
    v-model="isOpenConfirmDelete"
    :header="DELETE_OPERATION_CONFIRM_HEADER"
    :message="DELETE_OPERATION_CONFIRM_MESSAGE"
    @confirm="deleteOperation"
  />
</template>
