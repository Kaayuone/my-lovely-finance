<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppToast from '@/components/AppToast.vue';
import DatabaseErrorScreen from '@/components/DatabaseErrorScreen.vue';

import { useRouter } from 'vue-router';
import { useAppToast } from '@/services/feedback';
import { useDraftStore } from '@/stores/draftStore';

import { dbInitStatus } from '@/database/bootstrap';
import { registerAppStateListener } from '@/services/appState';
import { isCaptureSupported, registerCaptureChangeListener } from '@/services/capture';
import { registerHardwareBackListener } from '@/services/hardwareBack';
import { registerKeyboardListeners } from '@/services/keyboard';

import { onMounted, onUnmounted, watch } from 'vue';

type ListenerRegistrar = () => Promise<() => void>;
type ListenerSetter = (remove: () => void) => void;

let removeCaptureListeners: Array<() => void> = [];
let isUnmounted = false;
let removeHardwareBackListener: (() => void) | undefined;
let removeKeyboardListeners: (() => void) | undefined;

const router = useRouter();
const { showOperationError } = useAppToast();
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
  void registerNativeListeners();
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
  removeHardwareBackListener?.();
  removeKeyboardListeners?.();
});

async function registerOptionalListener(register: ListenerRegistrar, setRemove: ListenerSetter) {
  try {
    const remove = await register();
    if (isUnmounted) {
      remove();
      return;
    }
    setRemove(remove);
  } catch (error) {
    if (!isUnmounted) showOperationError('setupNativeFeatures', error);
  }
}

async function registerNativeListeners() {
  await Promise.all([
    registerOptionalListener(
      () => registerHardwareBackListener(router),
      remove => {
        removeHardwareBackListener = remove;
      },
    ),
    registerOptionalListener(registerKeyboardListeners, remove => {
      removeKeyboardListeners = remove;
    }),
  ]);
}

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
  <AppToast />

  <!-- main.ts mounts the app once the database has opened or failed, so `pending` never renders -->
  <DatabaseErrorScreen v-if="dbInitStatus === 'failed'" />

  <RouterView v-else-if="dbInitStatus === 'ready'" />
</template>
