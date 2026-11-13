<script setup lang="ts">
import FloatLabel from 'primevue/floatlabel';
import Select from 'primevue/select';
import FieldError from './FieldError.vue';
import { computed } from 'vue';
import { CURRENCY_OPTIONS } from '@/constants/currency';

// PrimeVue types `options` as a mutable array, and the shared list is read-only
const OPTIONS = [...CURRENCY_OPTIONS];

defineOptions({ inheritAttrs: false });

const {
  id,
  error,
  required = false,
} = defineProps<{
  id: string;
  error?: string;
  required?: boolean;
}>();

const model = defineModel<string | null>({ required: true });

const label = computed(() => `Валюта${required ? '*' : ''}`);
</script>

<template>
  <div :class="$attrs.class">
    <FloatLabel variant="on">
      <Select
        v-model="model"
        :input-id="id"
        :invalid="Boolean(error)"
        :options="OPTIONS"
        :pt="{ overlay: { class: 'w-[min(16rem,calc(100vw-2rem))]' } }"
        option-label="label"
        option-value="code"
        fluid
      >
        <template #value="{ value }">{{ value }}</template>
      </Select>
      <label :for="id">{{ label }}</label>
    </FloatLabel>

    <FieldError :message="error" class="mt-1 block" />
  </div>
</template>
