import { defineStore } from 'pinia';
import { ref } from 'vue';

import {
  CAPTURE_JOURNAL_EVENTS_LIMIT,
  CAPTURE_JOURNAL_NOTIFICATIONS_LIMIT,
  CAPTURE_JOURNAL_SKIPPED_LIMIT,
  getCaptureSources,
  getCaptureStatus,
  getCapturedNotifications,
  getLaunchableApps,
  getListenerEvents,
  getSkippedNotifications,
  isCaptureSupported,
  setCaptureSourceEnabled,
} from '@/services/capture';

import type {
  CaptureApp,
  CaptureStatus,
  CapturedNotification,
  ListenerEvent,
  SkippedNotification,
} from '@/services/capture';

function sortByLabel(apps: CaptureApp[]): CaptureApp[] {
  const collator = new Intl.Collator('ru', { sensitivity: 'base' });
  return [...apps].sort((a, b) => collator.compare(a.label, b.label));
}

// Notification capture as the screens see it. On the web there is no listener: every load is a
// no-op there and the state stays empty, so the screens show «only on Android» instead
export const useCaptureStore = defineStore('capture', () => {
  const supported = isCaptureSupported();

  const appsLoading = ref(false);
  // null until the first load: the screen shows no access warning before it knows
  const status = ref<CaptureStatus | null>(null);
  const sources = ref<CaptureApp[]>([]);
  const apps = ref<CaptureApp[]>([]);
  const notifications = ref<CapturedNotification[]>([]);
  const skippedNotifications = ref<SkippedNotification[]>([]);
  const listenerEvents = ref<ListenerEvent[]>([]);

  async function loadStatus() {
    if (!supported) return;
    status.value = await getCaptureStatus();
  }

  async function loadSources() {
    if (!supported) return;
    sources.value = sortByLabel(await getCaptureSources());
  }

  async function loadJournal() {
    if (!supported) return;
    const [loadedNotifications, loadedSkipped, loadedEvents] = await Promise.all([
      getCapturedNotifications(CAPTURE_JOURNAL_NOTIFICATIONS_LIMIT),
      getSkippedNotifications(CAPTURE_JOURNAL_SKIPPED_LIMIT),
      getListenerEvents(CAPTURE_JOURNAL_EVENTS_LIMIT),
    ]);
    notifications.value = loadedNotifications;
    skippedNotifications.value = loadedSkipped;
    listenerEvents.value = loadedEvents;
  }

  async function loadApps() {
    if (!supported) return;
    appsLoading.value = true;
    try {
      apps.value = sortByLabel(await getLaunchableApps());
    } finally {
      appsLoading.value = false;
    }
  }

  async function setSourceEnabled(packageName: string, enabled: boolean) {
    await setCaptureSourceEnabled(packageName, enabled);
  }

  return {
    supported,
    appsLoading,
    status,
    sources,
    apps,
    notifications,
    skippedNotifications,
    listenerEvents,
    loadStatus,
    loadSources,
    loadJournal,
    loadApps,
    setSourceEnabled,
  };
});
