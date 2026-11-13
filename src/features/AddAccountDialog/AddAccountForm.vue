<script setup lang="ts">
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import CurrencySelect from '@/components/CurrencySelect.vue';
import InputAmountField from '@/components/InputAmountField.vue';
import InputTextField from '@/components/InputTextField.vue';
import CardDigitsField from './CardDigitsField.vue';

import { useCaptureStore } from '@/stores/captureStore';

import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import type { FormErrors } from '@/services/validation';
import type { AccountForm, BankAppOption } from './types';

import { ACCOUNT_TYPE_OPTIONS, NO_BANK_APP_OPTION } from './constants';

// A saved account keeps its type and currency: its operations are in that currency
const { errors, typeAndCurrencyDisabled = false } = defineProps<{
  errors: FormErrors;
  typeAndCurrencyDisabled?: boolean;
}>();

const form = defineModel<AccountForm>({ required: true });

const captureStore = useCaptureStore();
const { sources } = storeToRefs(captureStore);

const isCard = computed(() => form.value.type === 'card');
// The apps notifications are captured from. A linked app taken off that list since stays offered
// under its package name, or the field would show it as empty
const bankAppOptions = computed(() => {
  const options: BankAppOption[] = sources.value.map(source => ({
    label: source.label,
    value: source.packageName,
  }));
  const linked = form.value.bankPackage;
  if (linked && !options.some(option => option.value === linked)) {
    options.push({ label: linked, value: linked });
  }
  return [NO_BANK_APP_OPTION, ...options];
});
// The web build captures nothing, and with no app chosen for capture there is nothing to pick
const isBankAppShown = computed(
  () =>
    isCard.value &&
    captureStore.supported &&
    (sources.value.length > 0 || form.value.bankPackage !== null),
);
const cardDigitsError = computed(() =>
  form.value.cardDigits.map((_, index) => errors[`cardDigits.${index}`]).find(Boolean),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <InputTextField id="account_name" v-model="form.name" :error="errors.name" label="Название*" />

    <SelectButton
      v-model="form.type"
      :options="ACCOUNT_TYPE_OPTIONS"
      :allow-empty="false"
      :disabled="typeAndCurrencyDisabled"
      option-label="label"
      option-value="value"
      aria-label="Тип счёта"
      fluid
    />

    <!-- CurrencySelect cannot be disabled, and the currency of a saved account is only shown -->
    <FloatLabel v-if="typeAndCurrencyDisabled" variant="on">
      <InputText id="account_currency" :model-value="form.currency ?? ''" disabled fluid />
      <label for="account_currency">Валюта*</label>
    </FloatLabel>

    <CurrencySelect
      v-else
      id="account_currency"
      v-model="form.currency"
      :error="errors.currency"
      required
    />

    <InputAmountField
      id="account_opening_balance"
      v-model="form.openingBalanceText"
      :currency="form.currency"
      :error="errors.openingBalanceText"
      label="Начальный остаток"
      signed
    />

    <template v-if="isCard">
      <FloatLabel v-if="isBankAppShown" variant="on">
        <Select
          v-model="form.bankPackage"
          :options="bankAppOptions"
          :pt="{
            overlay: { class: 'max-w-[calc(100vw-2rem)]' },
            option: { class: 'whitespace-normal wrap-break-word' },
          }"
          input-id="account_bank_app"
          option-label="label"
          option-value="value"
          fluid
        />
        <label for="account_bank_app">Приложение банка</label>
      </FloatLabel>

      <CardDigitsField
        id="account_card_digits"
        v-model:digits="form.cardDigits"
        v-model:new-digits="form.newCardDigits"
        :digits-error="cardDigitsError"
        :new-digits-error="errors.newCardDigits"
      />
    </template>
  </div>
</template>
