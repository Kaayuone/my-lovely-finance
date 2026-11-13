<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import WheelPicker from './WheelPicker.vue';

import {
  useHardwareBackHandler,
  HARDWARE_BACK_PRIORITY_DRAWER_DIALOG,
} from '@/services/hardwareBack';

import { computed, ref } from 'vue';

type TimeOfDay = { hours: number; minutes: number };

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  label: String(i).padStart(2, '0'),
  value: i,
}));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  label: String(i).padStart(2, '0'),
  value: i,
}));
// Same treatment as ConfirmActionDialog: Aura pads the dialog with 1.25rem (`p-5`), and
// `.p-dialog-title` sets its own font-size token, so the body scale is restated to match
// HeaderShell's h1.
const TIME_DIALOG_PT = {
  root: { class: 'w-full max-w-[min(20rem,calc(100vw-2rem))] bg-app' },
  header: { class: 'w360:p-5 p-4' },
  title: { class: 'w400:text-base text-sm leading-tight' },
  content: { class: 'w360:px-5 w360:pb-5 px-4 pb-4' },
};

const {
  id,
  label,
  modelValue,
  hoursOnly = false,
} = defineProps<{
  id: string;
  label: string;
  modelValue: TimeOfDay | null;
  // The minutes column is pinned to `00`: the wheel is replaced by a static label and every
  // applied time is a whole hour
  hoursOnly?: boolean;
}>();

const emit = defineEmits<{
  'update:model-value': [value: TimeOfDay];
}>();

const isOpen = ref(false);
const draftHours = ref(0);
const draftMinutes = ref(0);

useHardwareBackHandler({
  priority: HARDWARE_BACK_PRIORITY_DRAWER_DIALOG,
  isActive: () => isOpen.value,
  onBack: () => {
    isOpen.value = false;
  },
});

const timeLabel = computed(() => {
  if (!modelValue) return '';

  const hours = String(modelValue.hours).padStart(2, '0');
  const minutes = String(modelValue.minutes).padStart(2, '0');
  return `${hours}:${minutes}`;
});

function openPicker() {
  // An empty field starts the wheels at the current time, so a fresh entry lands near "now"
  const now = new Date();
  draftHours.value = modelValue?.hours ?? now.getHours();
  draftMinutes.value = hoursOnly ? 0 : (modelValue?.minutes ?? now.getMinutes());
  isOpen.value = true;
}

function applyTime() {
  emit('update:model-value', { hours: draftHours.value, minutes: draftMinutes.value });
  isOpen.value = false;
}
</script>

<template>
  <div>
    <FloatLabel variant="on">
      <InputText
        :id
        :model-value="timeLabel"
        class="cursor-pointer"
        inputmode="none"
        readonly
        fluid
        @click="openPicker"
        @keydown.enter.prevent="openPicker"
        @keydown.space.prevent="openPicker"
      />
      <label :for="id">{{ label }}</label>
    </FloatLabel>

    <Dialog v-model:visible="isOpen" :pt="TIME_DIALOG_PT" :header="label" modal>
      <div class="flex items-center justify-center gap-2">
        <WheelPicker v-model="draftHours" :options="HOUR_OPTIONS" class="w-20" label="Часы" />

        <span class="text-lg font-semibold">:</span>

        <span v-if="hoursOnly" class="text-primary w-20 text-center font-semibold tabular-nums">
          00
        </span>
        <WheelPicker
          v-else
          v-model="draftMinutes"
          :options="MINUTE_OPTIONS"
          class="w-20"
          label="Минуты"
        />
      </div>

      <div class="w360:mt-4 mt-3 flex justify-end gap-2">
        <Button label="Отмена" variant="text" @click="isOpen = false" />
        <Button label="Готово" autofocus @click="applyTime" />
      </div>
    </Dialog>
  </div>
</template>
