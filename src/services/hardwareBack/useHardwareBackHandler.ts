import { onUnmounted, watch } from 'vue';

import { registerHardwareBackHandler, unregisterHardwareBackHandler } from './hardwareBack.service';

import type { HardwareBackHandler, HardwareBackHandlerOptions } from './hardwareBack.types';

export function useHardwareBackHandler(options: HardwareBackHandlerOptions) {
  const handler: HardwareBackHandler = { id: Symbol('hardwareBackHandler'), ...options };
  let registered = false;

  // Registered on opening rather than on mounting, so that of two handlers on one priority the one
  // opened later takes the back. A sync watcher keeps that order even within a single tick.
  watch(
    options.isActive,
    active => {
      if (active) register();
      else unregister();
    },
    { immediate: true, flush: 'sync' },
  );

  onUnmounted(unregister);

  function register() {
    if (registered) return;
    registerHardwareBackHandler(handler);
    registered = true;
  }

  function unregister() {
    if (!registered) return;
    unregisterHardwareBackHandler(handler.id);
    registered = false;
  }
}
