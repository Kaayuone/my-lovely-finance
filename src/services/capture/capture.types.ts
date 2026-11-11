import type { PluginListenerHandle } from '@capacitor/core';

export type CaptureStatus = {
  // Notification access is switched on for the app in the system settings
  accessGranted: boolean;
  // The system has the listener of this process bound right now and delivers notifications to it
  listenerConnected: boolean;
  // Build.VERSION.SDK_INT: from 33, an APK installed from a file needs «restricted settings» allowed
  sdkInt: number;
};

export type CaptureApp = {
  packageName: string;
  label: string;
  // PNG data URL; null for an app removed since it was chosen
  icon: string | null;
  // The SMS app of the phone: among several SMS apps it is the one that gets the bank messages
  isDefaultSms: boolean;
};

// `restored` — found in the shade when the listener connected: posted while nobody listened
export type CaptureOrigin = 'posted' | 'restored';

export type CapturedNotification = {
  id: number;
  packageName: string;
  appLabel: string;
  postedAt: number;
  capturedAt: number;
  origin: CaptureOrigin;
  title: string | null;
  text: string | null;
  bigText: string | null;
  subText: string | null;
  // The newest message of a messenger notification, or the lines of an inbox-style one
  lines: string | null;
};

// A notification of a chosen app the amount filter dropped: the app and the time, never the text
export type SkippedNotification = {
  id: number;
  packageName: string;
  appLabel: string;
  postedAt: number;
};

export type ListenerEventKind = 'connected' | 'disconnected' | 'rebind_requested';

export type ListenerEvent = {
  id: number;
  kind: ListenerEventKind;
  at: number;
  // Time since the phone booted when the event happened
  uptimeMs: number;
};

// The Android half is `CapturePlugin.java`; there is no web half, the service answers before it
export type CapturePluginApi = {
  getStatus(): Promise<CaptureStatus>;
  openAccessSettings(): Promise<{ opened: boolean }>;
  openAppDetails(): Promise<{ opened: boolean }>;
  requestRebind(): Promise<void>;
  getLaunchableApps(): Promise<{ apps: CaptureApp[] }>;
  getSources(): Promise<{ sources: CaptureApp[] }>;
  setSourceEnabled(options: { packageName: string; enabled: boolean }): Promise<void>;
  getNotifications(options: { limit: number }): Promise<{ notifications: CapturedNotification[] }>;
  getSkippedNotifications(options: { limit: number }): Promise<{ skipped: SkippedNotification[] }>;
  getListenerEvents(options: { limit: number }): Promise<{ events: ListenerEvent[] }>;
  addListener(eventName: 'changed', listener: () => void): Promise<PluginListenerHandle>;
};
