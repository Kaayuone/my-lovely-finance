<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';

import {
  useHardwareBackHandler,
  HARDWARE_BACK_PRIORITY_CONFIRM_DIALOG,
} from '@/services/hardwareBack';

import { computed } from 'vue';

// Aura pads the dialog with 1.25rem (`p-5`); tighten it below 360px. `.p-dialog-title` sets
// its own font-size token, so the body scale has to be restated to match HeaderShell's h1
// (which only inherits because preflight resets heading sizes).
const DIALOG_PT = {
  root: { class: 'w-full max-w-[min(24rem,calc(100vw-2rem))] bg-app' },
  header: { class: 'w360:p-5 p-4' },
  title: { class: 'w400:text-base text-sm leading-tight' },
  content: { class: 'w360:px-5 w360:pb-5 px-4 pb-4' },
};

const {
  modelValue,
  header,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
} = defineProps<{
  modelValue: boolean;
  header: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  'update:model-value': [value: boolean];
  confirm: [];
}>();

const visible = computed({
  get: () => modelValue,
  set: value => emit('update:model-value', value),
});

useHardwareBackHandler({
  priority: HARDWARE_BACK_PRIORITY_CONFIRM_DIALOG,
  isActive: () => visible.value,
  onBack: () => {
    visible.value = false;
  },
});

// The button stays tappable while the dialog plays its leave animation
function confirm() {
  if (!visible.value) return;

  emit('confirm');
  visible.value = false;
}
</script>

<template>
  <Dialog v-model:visible="visible" :pt="DIALOG_PT" :header modal>
    <p class="wrap-break-word">{{ message }}</p>

    <div class="w360:mt-4 mt-3 flex justify-end gap-2">
      <Button :label="cancelLabel" variant="text" @click="visible = false" />
      <Button :label="confirmLabel" autofocus @click="confirm" />
    </div>
  </Dialog>
</template>
