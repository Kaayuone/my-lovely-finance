<script setup lang="ts">
import { X } from '@lucide/vue';
import FloatLabel from 'primevue/floatlabel';
import Textarea from 'primevue/textarea';

import { computed, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const { id, label } = defineProps<{
  id: string;
  label: string;
}>();

const model = defineModel<string>();

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
  <FloatLabel class="relative" :class="rootClass" variant="on">
    <Textarea
      :id
      v-model="model"
      :pt="{ root: { style: 'padding-inline-end: 2.5rem' } }"
      v-bind="inputAttrs"
      fluid
    />
    <label :for="id">{{ label }}</label>

    <button
      v-show="model"
      type="button"
      class="text-muted-color absolute top-3 right-3 z-10"
      aria-label="Очистить"
      @mousedown.prevent
      @click="clear"
    >
      <X :size="16" />
    </button>
  </FloatLabel>
</template>
