<script setup lang="ts">
import { BellOff } from '@lucide/vue';
import EmptyState from '@/components/EmptyState.vue';
import CaptureAccessCard from './components/CaptureAccessCard.vue';
import CaptureListenerEventList from './components/CaptureListenerEventList.vue';
import CaptureNotificationList from './components/CaptureNotificationList.vue';
import CaptureSkippedList from './components/CaptureSkippedList.vue';
import CaptureSourcesCard from './components/CaptureSourcesCard.vue';

import { useCaptureStore } from '@/stores/captureStore';
import { useCaptureRefresh } from './useCaptureRefresh';

import { storeToRefs } from 'pinia';
import { onMounted } from 'vue';

const captureStore = useCaptureStore();
const { status, sources, notifications, skippedNotifications, listenerEvents } =
  storeToRefs(captureStore);
useCaptureRefresh(loadCapture, loadListenerState);

onMounted(async () => {
  try {
    await loadCapture();
  } catch (error) {
    console.error('Failed to load the capture screen', error);
  }
});

async function loadCapture() {
  await Promise.all([
    captureStore.loadStatus(),
    captureStore.loadSources(),
    captureStore.loadJournal(),
  ]);
}

// A connect or a disconnect of the listener changes its status as well as the journal
async function loadListenerState() {
  await Promise.all([captureStore.loadStatus(), captureStore.loadJournal()]);
}

async function onAccessChanged() {
  try {
    await loadListenerState();
  } catch (error) {
    console.error('Failed to reload the capture status', error);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4">
    <EmptyState
      v-if="!captureStore.supported"
      :icon="BellOff"
      title="Только на Android"
      description="Уведомления банков видны только приложению на телефоне — в браузере собирать нечего."
    />

    <template v-else-if="status">
      <CaptureAccessCard :status @changed="onAccessChanged" />
      <CaptureSourcesCard :sources />
      <CaptureNotificationList :notifications />
      <CaptureSkippedList :skipped="skippedNotifications" />
      <CaptureListenerEventList :events="listenerEvents" />
    </template>
  </div>
</template>
