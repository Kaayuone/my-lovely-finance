import { Capacitor } from '@capacitor/core';
import { Capture } from './capture.plugin';
import type {
  CaptureApp,
  CaptureStatus,
  CapturedNotification,
  ListenerEvent,
  PendingNotification,
  SkippedNotification,
} from './capture.types';

// Notifications of other apps are visible only to a native Android listener: the web build has none,
// and nothing below may reach the plugin there
export function isCaptureSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function getCaptureStatus(): Promise<CaptureStatus> {
  return Capture.getStatus();
}

// Notification access has no permission dialog: this opens the switch of the app in the system
// settings. False when no settings page could be started
export async function openCaptureAccessSettings(): Promise<boolean> {
  const { opened } = await Capture.openAccessSettings();
  return opened;
}

export async function openAppDetails(): Promise<boolean> {
  const { opened } = await Capture.openAppDetails();
  return opened;
}

export async function requestListenerRebind(): Promise<void> {
  await Capture.requestRebind();
}

export async function getLaunchableApps(): Promise<CaptureApp[]> {
  const { apps } = await Capture.getLaunchableApps();
  return apps;
}

export async function getCaptureSources(): Promise<CaptureApp[]> {
  const { sources } = await Capture.getSources();
  return sources;
}

export async function setCaptureSourceEnabled(
  packageName: string,
  enabled: boolean,
): Promise<void> {
  await Capture.setSourceEnabled({ packageName, enabled });
}

export async function getCapturedNotifications(limit: number): Promise<CapturedNotification[]> {
  const { notifications } = await Capture.getNotifications({ limit });
  return notifications;
}

// The oldest notifications of the queue the app has not taken into its drafts yet (ADR-0003)
export async function getPendingNotifications(limit: number): Promise<PendingNotification[]> {
  const { notifications } = await Capture.getPendingNotifications({ limit });
  return notifications;
}

// Only once the drafts of a batch are committed: the queue stops handing out every notification up
// to this id. Before the commit, a process that dies would lose the batch
export async function acknowledgeNotifications(upToId: number): Promise<void> {
  await Capture.acknowledgeNotifications({ upToId });
}

export async function getSkippedNotifications(limit: number): Promise<SkippedNotification[]> {
  const { skipped } = await Capture.getSkippedNotifications({ limit });
  return skipped;
}

export async function getListenerEvents(limit: number): Promise<ListenerEvent[]> {
  const { events } = await Capture.getListenerEvents({ limit });
  return events;
}

// Fires when the listener wrote to the capture queue while the app is open
export async function registerCaptureChangeListener(onChange: () => void): Promise<() => void> {
  const listener = await Capture.addListener('changed', onChange);
  return () => listener.remove();
}
