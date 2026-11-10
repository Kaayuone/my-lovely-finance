<script setup lang="ts">
import { ChevronRight } from '@lucide/vue';
import ToggleSwitch from 'primevue/toggleswitch';

import { useCaptureStore } from '@/stores/captureStore';
import { useSettingsStore } from '@/stores/settingsStore';

import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';

import { APP_VERSION } from '@/constants/app';
import { CAPTURE_FEATURE_TITLE } from '@/constants/capture';

const settingsStore = useSettingsStore();
const captureStore = useCaptureStore();
const { darkMode } = storeToRefs(settingsStore);
const { status: captureStatus } = storeToRefs(captureStore);

const captureSummary = computed(() => {
  if (!captureStore.supported) return 'Только на Android';
  if (!captureStatus.value) return '';
  if (!captureStatus.value.accessGranted) return 'Выключен';
  return captureStatus.value.listenerConnected ? 'Включён' : 'Служба не на связи';
});

onMounted(async () => {
  try {
    await captureStore.loadStatus();
  } catch (error) {
    console.error('Failed to load the capture status', error);
  }
});

async function onDarkModeChange(enabled: boolean) {
  try {
    await settingsStore.setDarkMode(enabled);
  } catch (error) {
    console.error('Failed to save the dark mode setting', error);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4">
    <section class="bg-card rounded-xl">
      <RouterLink
        :to="{ name: 'capture' }"
        class="flex items-center justify-between gap-3 px-4 py-3"
      >
        <span class="min-w-0">
          <span class="text-color block">{{ CAPTURE_FEATURE_TITLE }}</span>
          <span v-if="captureSummary" class="text-muted-color block text-sm">
            {{ captureSummary }}
          </span>
        </span>
        <ChevronRight :size="20" class="text-muted-color shrink-0" aria-hidden="true" />
      </RouterLink>
    </section>

    <section class="bg-card rounded-xl">
      <label for="settings-dark-mode" class="flex items-center justify-between gap-3 px-4 py-3">
        <span class="text-color">Тёмная тема</span>
        <ToggleSwitch
          :model-value="darkMode"
          input-id="settings-dark-mode"
          @update:model-value="onDarkModeChange"
        />
      </label>
    </section>

    <p class="text-muted-color text-center text-xs">Версия {{ APP_VERSION }}</p>
  </div>
</template>
