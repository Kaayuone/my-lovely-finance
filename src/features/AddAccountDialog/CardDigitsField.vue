<script setup lang="ts">
import { Plus, X } from '@lucide/vue';
import Button from 'primevue/button';
import FieldError from '@/components/FieldError.vue';
import InputTextField from '@/components/InputTextField.vue';
import { ref, watch } from 'vue';
import { getNewCardDigitsError } from './validation';

const { id, digitsError, newDigitsError } = defineProps<{
  id: string;
  // A rule the digits already in the list break
  digitsError?: string;
  // A rule the typed digits break, shown once the form has been saved
  newDigitsError?: string;
}>();

const digits = defineModel<string[]>('digits', { required: true });
const newDigits = defineModel<string>('newDigits', { required: true });

// What the add button found wrong with the typed digits: shown before the form is ever saved, and
// gone as soon as the digits change
const addError = ref<string>();

watch(newDigits, () => {
  addError.value = undefined;
});

function addCard() {
  if (newDigits.value === '') return;

  const message = getNewCardDigitsError(newDigits.value, digits.value);
  if (message) {
    addError.value = message;
    return;
  }

  digits.value = [...digits.value, newDigits.value];
  newDigits.value = '';
}

function removeCard(index: number) {
  digits.value = digits.value.filter((_, digitsIndex) => digitsIndex !== index);
}
</script>

<template>
  <div class="w-full">
    <div class="flex items-start gap-2">
      <InputTextField
        :id
        v-model="newDigits"
        :error="newDigitsError ?? addError"
        class="min-w-0 flex-1"
        label="Последние 4 цифры карты"
        autocomplete="off"
        inputmode="numeric"
        maxlength="4"
        @keydown.enter.prevent="addCard"
      />

      <Button
        :disabled="!newDigits"
        class="shrink-0 rounded-full p-2"
        variant="text"
        aria-label="Добавить карту"
        @click="addCard"
      >
        <Plus :size="24" />
      </Button>
    </div>

    <ul v-if="digits.length" class="mt-2 flex flex-wrap gap-2">
      <li
        v-for="(cardDigits, index) in digits"
        :key="cardDigits"
        class="bg-card text-color flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
      >
        <span>·{{ cardDigits }}</span>
        <button
          :aria-label="`Убрать карту ·${cardDigits}`"
          type="button"
          class="text-muted-color flex size-7 items-center justify-center rounded-full"
          @click="removeCard(index)"
        >
          <X :size="16" />
        </button>
      </li>
    </ul>

    <FieldError :message="digitsError" class="mt-1 block" />
  </div>
</template>
