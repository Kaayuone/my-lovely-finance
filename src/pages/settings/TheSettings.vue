<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch';
import { useSettingsStore } from '@/stores/settingsStore';
import { storeToRefs } from 'pinia';
import { APP_VERSION } from '@/constants/app';

const settingsStore = useSettingsStore();
const { darkMode } = storeToRefs(settingsStore);

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
