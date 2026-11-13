<script setup lang="ts">
import SelectButton from 'primevue/selectbutton';
import ToggleSwitch from 'primevue/toggleswitch';
import InputAmountField from '@/components/InputAmountField.vue';
import InputDateTime from '@/components/InputDateTime.vue';
import InputTextField from '@/components/InputTextField.vue';
import TextareaField from '@/components/TextareaField.vue';
import AccountSelect from './AccountSelect.vue';
import CategoryPicker from './CategoryPicker.vue';

import { useCategoryStore } from '@/stores/categoryStore';

import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { accountCurrency, changeOperationFormKind, needsCreditAmount } from '../utils';

import type { FormErrors } from '@/services/validation';
import type { OperationForm, OperationFormContext, OperationFormKind } from '../types';

import { OPERATION_KIND_OPTIONS } from '../constants';

const { errors, context } = defineProps<{
  errors: FormErrors;
  context: OperationFormContext;
}>();

const form = defineModel<OperationForm>({ required: true });

const { categories } = storeToRefs(useCategoryStore());

// The only way the kind changes: the switch drops what the new kind cannot carry
const kind = computed({
  get: () => form.value.kind,
  set: (value: OperationFormKind) => {
    form.value = changeOperationFormKind(form.value, value, categoriesById.value);
  },
});

const categoriesById = computed(
  () => new Map(categories.value.map(category => [category.id, category])),
);
const currency = computed(() => accountCurrency(form.value.accountId, context.accountsById));
const toCurrency = computed(() => accountCurrency(form.value.toAccountId, context.accountsById));
const isCreditAmountShown = computed(() => needsCreditAmount(form.value, context));
const keptAccountIds = computed(() => {
  const { original } = context;
  return original ? [original.accountId, original.toAccountId].filter(id => id !== null) : [];
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <SelectButton
      v-model="kind"
      :allow-empty="false"
      :options="OPERATION_KIND_OPTIONS"
      option-label="label"
      option-value="value"
      fluid
    />

    <AccountSelect
      id="operation_account"
      v-model="form.accountId"
      :error="errors.accountId"
      :kept-account-ids
      label="Счёт*"
    />

    <InputAmountField
      id="operation_amount"
      v-model="form.amountText"
      :currency
      :error="errors.amountText"
      label="Сумма*"
    />

    <div v-if="form.kind === 'expense'" class="flex items-center gap-3">
      <ToggleSwitch v-model="form.isRefund" input-id="operation_refund" />
      <label for="operation_refund">Возврат</label>
    </div>

    <template v-if="form.kind !== 'transfer'">
      <CategoryPicker
        id="operation_category"
        v-model="form.categoryId"
        :kind="form.kind"
        :error="errors.categoryId"
        required
      />

      <InputTextField id="operation_payee" v-model="form.payee" label="Получатель" />
    </template>

    <template v-else>
      <AccountSelect
        id="operation_to_account"
        v-model="form.toAccountId"
        :error="errors.toAccountId"
        :kept-account-ids
        label="На счёт*"
      />

      <InputAmountField
        v-if="isCreditAmountShown"
        id="operation_to_amount"
        v-model="form.toAmountText"
        :currency="toCurrency"
        :error="errors.toAmountText"
        label="Зачислено*"
      />

      <InputAmountField
        id="operation_fee"
        v-model="form.feeText"
        :currency
        :error="errors.feeText"
        label="Комиссия"
      />
    </template>

    <InputDateTime id="operation_date" v-model="form.dateTime" :error="errors.dateTime" required />

    <TextareaField id="operation_note" v-model="form.note" label="Заметка" />
  </div>
</template>
