<script setup lang="ts">
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import FieldError from './FieldError.vue';
import { computed, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const {
  id,
  label,
  currency,
  error,
  signed = false,
} = defineProps<{
  id: string;
  label: string;
  // The code shown at the end of the field; `null` while the currency is not chosen yet
  currency: string | null;
  error?: string;
  // An amount that may be negative gets a sign button: a numeric keyboard on Android may have no minus
  signed?: boolean;
}>();

// The text as typed, never a number: the form reads it with `parseAmount` in the account currency
const text = defineModel<string>({ required: true });

const attrs = useAttrs();

const rootClass = computed(() => attrs.class);
const inputAttrs = computed(() => {
  const rest = { ...attrs };
  delete rest.class;
  return rest;
});
// The end of the field holds the currency code (up to 2rem) and the sign button (2rem); the padding
// covers them and their insets with 0.5rem to spare, so typed digits never run under them
const inputPt = computed(() => {
  if (!signed && !currency) return undefined;

  const room = signed ? (currency ? '5rem' : '2.75rem') : '3.25rem';
  return { root: { style: `padding-inline-end: ${room}` } };
});

function toggleSign() {
  text.value = /^\s*-/.test(text.value)
    ? text.value.replace('-', '')
    : text.value.replace(/^(\s*)\+?/, '$1-');
}
</script>

<template>
  <div :class="rootClass" class="w-full min-w-0">
    <FloatLabel class="relative" variant="on">
      <InputText
        :id
        v-model="text"
        :invalid="Boolean(error)"
        :pt="inputPt"
        v-bind="inputAttrs"
        autocomplete="off"
        inputmode="decimal"
        fluid
      />
      <label :for="id">{{ label }}</label>

      <div
        v-if="currency || signed"
        :class="signed ? 'right-1' : 'right-3'"
        class="pointer-events-none absolute inset-y-0 z-10 flex items-center gap-1"
      >
        <span v-if="currency" class="text-muted-color text-sm">{{ currency }}</span>
        <button
          v-if="signed"
          type="button"
          class="text-primary pointer-events-auto flex size-8 items-center justify-center rounded-full text-lg leading-none"
          aria-label="Сменить знак"
          @mousedown.prevent
          @click="toggleSign"
        >
          ±
        </button>
      </div>
    </FloatLabel>

    <FieldError :message="error" class="mt-1 block" />
  </div>
</template>
