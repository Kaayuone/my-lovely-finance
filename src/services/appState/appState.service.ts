import { App as CapacitorApp } from '@capacitor/app';

// The plugin emits the event on the web as well (from the document visibility), so the listener
// needs no platform check
export async function registerAppStateListener(onActive: () => void): Promise<() => void> {
  const listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onActive();
  });

  return () => listener.remove();
}
