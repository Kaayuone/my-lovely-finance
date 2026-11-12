<script setup lang="ts">
import { RouterView } from 'vue-router';
import DatabaseErrorScreen from '@/components/DatabaseErrorScreen.vue';

import { useDraftStore } from '@/stores/draftStore';

import { dbInitStatus } from '@/database/bootstrap';
import { registerAppStateListener } from '@/services/appState';
import { isCaptureSupported, registerCaptureChangeListener } from '@/services/capture';

import { onMounted, onUnmounted, watch } from 'vue';

let removeCaptureListeners: Array<() => void> = [];
let isUnmounted = false;

const draftStore = useDraftStore();

// The capture queue becomes drafts once the database is open — on the start and after «Повторить»
// of the error screen — then on every return to the app and whenever the listener writes to it
watch(
  dbInitStatus,
  status => {
    if (status === 'ready') void takeCaptureQueue();
  },
  { immediate: true },
);

onMounted(async () => {
  if (!isCaptureSupported()) return;
  try {
    const registered = await Promise.all([
      registerAppStateListener(() => void takeCaptureQueue()),
      registerCaptureChangeListener(() => void takeCaptureQueue()),
    ]);
    if (isUnmounted) registered.forEach(remove => remove());
    else removeCaptureListeners = registered;
  } catch (error) {
    console.error('Failed to listen for the capture queue', error);
  }
});

onUnmounted(() => {
  isUnmounted = true;
  removeCaptureListeners.forEach(remove => remove());
});

async function takeCaptureQueue() {
  // The drafts have nowhere to go until the database is open
  if (dbInitStatus.value !== 'ready') return;
  try {
    await draftStore.takeCaptureQueue();
  } catch (error) {
    console.error('Failed to move the capture queue into drafts', error);
  }
}
</script>

<template>
  <!-- main.ts mounts the app once the database has opened or failed, so `pending` never renders -->
  <DatabaseErrorScreen v-if="dbInitStatus === 'failed'" />

  <RouterView v-else-if="dbInitStatus === 'ready'" />
</template>
