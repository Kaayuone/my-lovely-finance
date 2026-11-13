<script setup lang="ts">
import { X } from '@lucide/vue';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import FieldError from './FieldError.vue';

import { computed, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const { id, label, error } = defineProps<{
  id: string;
  label: string;
  error?: string;
}>();

const [model, modifiers] = defineModel<string, 'uppercase'>({
  set(value) {
    return modifiers.uppercase && value ? value.toUpperCase() : value;
  },
});

const attrs = useAttrs();

const rootClass = computed(() => attrs.class);
const inputAttrs = computed(() => {
  const rest = { ...attrs };
  delete rest.class;
  return rest;
});

function clear() {
  model.value = '';
}
</script>

<template>
  <div class="w-full" :class="rootClass">
    <!-- w-full: the wrapper takes over the width FloatLabel had while it was the flex item -->
    <FloatLabel class="relative" variant="on">
      <InputText
        :id
        v-model="model"
        :invalid="Boolean(error)"
        :pt="{ root: { style: 'padding-inline-end: 2.5rem' } }"
        v-bind="inputAttrs"
        fluid
      />
      <label :for="id">{{ label }}</label>

      <button
        v-show="model"
        type="button"
        class="text-muted-color absolute top-1/2 right-3 z-10 -translate-y-1/2"
        aria-label="Очистить"
        @mousedown.prevent
        @click="clear"
      >
        <X :size="16" />
      </button>
    </FloatLabel>

    <FieldError :message="error" class="mt-1 block" />
  </div>
</template>
