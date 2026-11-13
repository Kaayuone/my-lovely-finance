import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { HARDWARE_BACK_PRIORITY_OVERLAY } from './constants';
import { closeTopOverlay, isOverlayOpen } from './overlayBack';

import type { Router } from 'vue-router';
import type { HardwareBackHandler } from './hardwareBack.types';

const handlers: HardwareBackHandler[] = [];

export function registerHardwareBackHandler(handler: HardwareBackHandler) {
  handlers.push(handler);
}

export function unregisterHardwareBackHandler(id: symbol) {
  const index = handlers.findIndex(handler => handler.id === id);
  if (index === -1) return;
  handlers.splice(index, 1);
}

export function dispatchHardwareBack() {
  const activeHandlers = handlers.filter(handler => handler.isActive());
  if (!activeHandlers.length) return false;

  // On a tie the handler registered last wins: it belongs to whatever opened last
  const topHandler = activeHandlers.reduce((current, handler) =>
    handler.priority >= current.priority ? handler : current,
  );
  topHandler.onBack();
  return true;
}

export async function registerHardwareBackListener(router: Router): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};

  // The plugin ignores whatever the callback returns, so async paths need their own boundary
  const listener = await CapacitorApp.addListener('backButton', () => {
    if (dispatchHardwareBack()) return;

    const route = router.currentRoute.value;
    if (route.name === 'inbox') {
      CapacitorApp.exitApp().catch(error => {
        console.error('Failed to exit the app on hardware back', error);
      });
      return;
    }

    const { backTo } = route.meta;
    if (backTo) {
      if (router.options.history.state.back) router.back();
      else {
        router.replace({ name: backTo }).catch(error => {
          console.error('Failed to navigate to the parent page on hardware back', error);
        });
      }
      return;
    }

    router.replace({ name: 'inbox' }).catch(error => {
      console.error('Failed to navigate to inbox on hardware back', error);
    });
  });

  // PrimeVue overlays register nothing themselves, so one handler covers every open one
  const overlayHandlerId = Symbol('overlayHardwareBackHandler');
  registerHardwareBackHandler({
    id: overlayHandlerId,
    priority: HARDWARE_BACK_PRIORITY_OVERLAY,
    isActive: isOverlayOpen,
    onBack: closeTopOverlay,
  });

  return () => {
    unregisterHardwareBackHandler(overlayHandlerId);
    return listener.remove();
  };
}
