<script setup lang="ts" generic="K extends string">
import Button from 'primevue/button';
import Drawer from 'primevue/drawer';
import {
  useHardwareBackHandler,
  HARDWARE_BACK_PRIORITY_ROW_ACTIONS,
} from '@/services/hardwareBack';
import { computed } from 'vue';
import type { Component } from 'vue';

export type RowAction<K extends string = string> = {
  value: K;
  label: string;
  icon: Component;
  danger?: boolean;
};

// Aura gives a bottom drawer a fixed height of its own, which leaves a sheet of one to three actions
// with an empty band: `h-auto` sizes it by its content. `.p-drawer-title` sets its own font-size
// token, so the body scale of the dialog titles is restated. The content padding lines the icons of
// the text buttons up with the title. Nothing in the sheet is there to be selected: the finger that
// opened it is still held over it.
const SHEET_PT = {
  root: {
    class:
      'bg-app max-w-column mx-auto h-auto max-h-[80vh] rounded-t-2xl select-none [-webkit-touch-callout:none]',
  },
  header: { class: 'px-5 pt-5 pb-2' },
  title: { class: 'w400:text-base line-clamp-2 min-w-0 text-sm leading-tight wrap-break-word' },
  content: { class: 'flex flex-col px-2 pb-3' },
};

const { modelValue, header, actions } = defineProps<{
  modelValue: boolean;
  header: string;
  actions: RowAction<K>[];
}>();

const emit = defineEmits<{
  'update:model-value': [value: boolean];
  select: [value: K];
}>();

const visible = computed({
  get: () => modelValue,
  set: value => emit('update:model-value', value),
});

useHardwareBackHandler({
  priority: HARDWARE_BACK_PRIORITY_ROW_ACTIONS,
  isActive: () => visible.value,
  onBack: close,
});

// The buttons stay tappable while the sheet plays its leave animation
function select(value: K) {
  if (!visible.value) return;

  emit('select', value);
  close();
}

function close() {
  visible.value = false;
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :pt="SHEET_PT"
    :show-close-icon="false"
    :aria-label="header"
    :header
    position="bottom"
  >
    <!-- The drawer focuses the first `[autofocus]` on opening. `undefined`, not false, for the rest:
         where the DOM has no `autofocus` property Vue would render `autofocus="false"` -->
    <Button
      v-for="(action, index) in actions"
      :key="action.value"
      :severity="action.danger ? 'danger' : 'secondary'"
      :autofocus="index === 0 || undefined"
      class="w-full justify-start gap-3 text-left"
      variant="text"
      @click="select(action.value)"
    >
      <component :is="action.icon" :size="20" class="shrink-0" />
      <span class="min-w-0">{{ action.label }}</span>
    </Button>
  </Drawer>
</template>
