import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Enabled by default; callers can disable feedback through setHapticsEnabled
let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

// Haptics must never break the calling flow, so failures are only logged
function run(action: () => Promise<void>) {
  if (!hapticsEnabled) return;
  if (!isNativePlatform()) return;
  action().catch(error => console.error('Haptics call failed', error));
}

export function vibrateTick() {
  run(() => Haptics.impact({ style: ImpactStyle.Light }));
}

export function vibrateSuccess() {
  run(() => Haptics.notification({ type: NotificationType.Success }));
}

export function vibrateError() {
  run(() => Haptics.notification({ type: NotificationType.Error }));
}
