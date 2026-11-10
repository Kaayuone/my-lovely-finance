import { registerAppStateListener } from '@/services/appState';
import { isCaptureSupported, registerCaptureChangeListener } from '@/services/capture';
import { onMounted, onUnmounted } from 'vue';

// Reloads the capture screen when the person comes back to the app — typically from the system
// settings, where notification access has just been switched — and while it is open, whenever the
// listener writes to the capture queue
export function useCaptureRefresh(
  onActive: () => Promise<void>,
  onCaptureChanged: () => Promise<void>,
) {
  if (!isCaptureSupported()) return;

  let removers: Array<() => void> = [];
  let unmounted = false;

  onMounted(async () => {
    try {
      const registered = await Promise.all([
        registerAppStateListener(() => void run(onActive)),
        registerCaptureChangeListener(() => void run(onCaptureChanged)),
      ]);
      if (unmounted) registered.forEach(remove => remove());
      else removers = registered;
    } catch (error) {
      console.error('Failed to listen for capture changes', error);
    }
  });

  onUnmounted(() => {
    unmounted = true;
    removers.forEach(remove => remove());
  });

  async function run(reload: () => Promise<void>) {
    try {
      await reload();
    } catch (error) {
      console.error('Failed to reload the capture screen', error);
    }
  }
}
