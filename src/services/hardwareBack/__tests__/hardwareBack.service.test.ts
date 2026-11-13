// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  dispatchHardwareBack,
  registerHardwareBackHandler,
  registerHardwareBackListener,
  unregisterHardwareBackHandler,
} from '@/services/hardwareBack/hardwareBack.service';
import {
  HARDWARE_BACK_PRIORITY_OVERLAY,
  HARDWARE_BACK_PRIORITY_CONFIRM_DIALOG,
} from '@/services/hardwareBack/constants';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(),
    exitApp: vi.fn(),
  },
}));

describe('hardwareBack.service', () => {
  const registeredIds: symbol[] = [];
  const listenerRemovers: Awaited<ReturnType<typeof registerHardwareBackListener>>[] = [];

  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorApp.addListener).mockResolvedValue({ remove: vi.fn() });
    vi.mocked(CapacitorApp.exitApp).mockResolvedValue();
  });

  afterEach(async () => {
    for (const id of registeredIds.splice(0)) unregisterHardwareBackHandler(id);
    for (const remove of listenerRemovers.splice(0)) await remove();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  function registerHandler(priority: number, isActive: () => boolean, onBack: () => void): symbol {
    const id = Symbol('testHandler');
    registerHardwareBackHandler({ id, priority, isActive, onBack });
    registeredIds.push(id);
    return id;
  }

  // A native listener registers the overlay handler, which outlives the test unless removed
  async function listen(router: Parameters<typeof registerHardwareBackListener>[0]) {
    listenerRemovers.push(await registerHardwareBackListener(router));
  }

  function openOverlay(className = 'p-select-overlay') {
    const overlay = document.createElement('div');
    const keydown = vi.fn();
    overlay.className = className;
    overlay.addEventListener('keydown', keydown);
    document.body.append(overlay);
    return keydown;
  }

  it('returns false when no active handlers are registered', () => {
    expect(dispatchHardwareBack()).toBe(false);
  });

  it('calls the active handler with the highest priority', () => {
    const lowBack = vi.fn();
    const highBack = vi.fn();

    registerHandler(100, () => true, lowBack);
    registerHandler(300, () => true, highBack);

    expect(dispatchHardwareBack()).toBe(true);
    expect(highBack).toHaveBeenCalledOnce();
    expect(lowBack).not.toHaveBeenCalled();
  });

  it('ignores inactive handlers', () => {
    const inactiveBack = vi.fn();
    const activeBack = vi.fn();

    registerHandler(300, () => false, inactiveBack);
    registerHandler(100, () => true, activeBack);

    expect(dispatchHardwareBack()).toBe(true);
    expect(activeBack).toHaveBeenCalledOnce();
    expect(inactiveBack).not.toHaveBeenCalled();
  });

  it('gives a tie to the handler registered last', () => {
    const firstBack = vi.fn();
    const lastBack = vi.fn();

    registerHandler(200, () => true, firstBack);
    registerHandler(200, () => true, lastBack);
    registerHandler(100, () => true, vi.fn());

    expect(dispatchHardwareBack()).toBe(true);
    expect(lastBack).toHaveBeenCalledOnce();
    expect(firstBack).not.toHaveBeenCalled();
  });

  it('unregisters handler by id', () => {
    const onBack = vi.fn();
    const id = registerHandler(100, () => true, onBack);

    unregisterHardwareBackHandler(id);

    expect(dispatchHardwareBack()).toBe(false);
    expect(onBack).not.toHaveBeenCalled();
  });

  describe('registerHardwareBackListener', () => {
    it('does not register listener on web', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      const remove = await registerHardwareBackListener({
        currentRoute: { value: { name: 'inbox', meta: {} } },
        replace: vi.fn(),
      } as never);

      expect(CapacitorApp.addListener).not.toHaveBeenCalled();
      expect(remove).toEqual(expect.any(Function));
      remove();
    });

    it('exits app on inbox when no handler consumed back press', async () => {
      let backHandler: (() => void) | undefined;
      vi.mocked(CapacitorApp.addListener).mockImplementation(async (_event, handler) => {
        backHandler = handler as () => void;
        return { remove: vi.fn() };
      });

      await listen({
        currentRoute: { value: { name: 'inbox', meta: {} } },
        replace: vi.fn(),
      } as never);

      backHandler?.();

      expect(CapacitorApp.exitApp).toHaveBeenCalledOnce();
    });

    it('navigates to inbox from another route when no handler consumed back press', async () => {
      let backHandler: (() => void) | undefined;
      const replace = vi.fn().mockResolvedValue(undefined);

      vi.mocked(CapacitorApp.addListener).mockImplementation(async (_event, handler) => {
        backHandler = handler as () => void;
        return { remove: vi.fn() };
      });

      await listen({
        currentRoute: { value: { name: 'operations', meta: {} } },
        replace,
      } as never);

      backHandler?.();

      expect(replace).toHaveBeenCalledExactlyOnceWith({ name: 'inbox' });
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('goes back through history on a route with a parent page', async () => {
      let backHandler: (() => void) | undefined;
      const back = vi.fn();
      const replace = vi.fn().mockResolvedValue(undefined);

      vi.mocked(CapacitorApp.addListener).mockImplementation(async (_event, handler) => {
        backHandler = handler as () => void;
        return { remove: vi.fn() };
      });

      await listen({
        currentRoute: { value: { name: 'capture-apps', meta: { backTo: 'capture' } } },
        options: { history: { state: { back: '/settings/capture' } } },
        back,
        replace,
      } as never);

      backHandler?.();

      expect(back).toHaveBeenCalledOnce();
      expect(replace).not.toHaveBeenCalled();
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('replaces a directly opened route with its parent page', async () => {
      let backHandler: (() => void) | undefined;
      const back = vi.fn();
      const replace = vi.fn().mockResolvedValue(undefined);

      vi.mocked(CapacitorApp.addListener).mockImplementation(async (_event, handler) => {
        backHandler = handler as () => void;
        return { remove: vi.fn() };
      });

      await listen({
        currentRoute: { value: { name: 'capture-apps', meta: { backTo: 'capture' } } },
        options: { history: { state: { back: null } } },
        back,
        replace,
      } as never);

      backHandler?.();

      expect(replace).toHaveBeenCalledExactlyOnceWith({ name: 'capture' });
      expect(back).not.toHaveBeenCalled();
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'inbox', meta: {} },
      { name: 'capture', meta: { backTo: 'settings' } },
      { name: 'operations', meta: {} },
    ])('lets an active handler consume back on $name before the fallback', async route => {
      let backHandler: (() => void) | undefined;
      const onBack = vi.fn();
      const back = vi.fn();
      const replace = vi.fn().mockResolvedValue(undefined);
      registerHandler(HARDWARE_BACK_PRIORITY_CONFIRM_DIALOG, () => true, onBack);

      vi.mocked(CapacitorApp.addListener).mockImplementation(async (_event, handler) => {
        backHandler = handler as () => void;
        return { remove: vi.fn() };
      });

      await listen({
        currentRoute: { value: route },
        options: { history: { state: { back: '/settings' } } },
        back,
        replace,
      } as never);

      backHandler?.();

      expect(onBack).toHaveBeenCalledOnce();
      expect(back).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it.each(['p-select-overlay', 'p-datepicker-panel'])(
      'closes an open %s before the dialog it was opened from',
      async className => {
        const dialogBack = vi.fn();
        registerHandler(HARDWARE_BACK_PRIORITY_CONFIRM_DIALOG, () => true, dialogBack);
        const overlayKeydown = openOverlay(className);

        await listen({
          currentRoute: { value: { name: 'operations' } },
          replace: vi.fn(),
        } as never);

        expect(dispatchHardwareBack()).toBe(true);
        expect(overlayKeydown).toHaveBeenCalledOnce();
        expect(dialogBack).not.toHaveBeenCalled();
      },
    );

    it('gives a tie to a handler registered after the open overlay handler', async () => {
      const onBack = vi.fn();
      const overlayKeydown = openOverlay();

      await listen({ currentRoute: { value: { name: 'operations' } }, replace: vi.fn() } as never);
      registerHandler(HARDWARE_BACK_PRIORITY_OVERLAY, () => true, onBack);

      expect(dispatchHardwareBack()).toBe(true);
      expect(onBack).toHaveBeenCalledOnce();
      expect(overlayKeydown).not.toHaveBeenCalled();
    });

    it('stops closing overlays once the listener is removed', async () => {
      const overlayKeydown = openOverlay();
      const remove = await registerHardwareBackListener({
        currentRoute: { value: { name: 'operations' } },
        replace: vi.fn(),
      } as never);

      await remove();

      expect(dispatchHardwareBack()).toBe(false);
      expect(overlayKeydown).not.toHaveBeenCalled();
    });

    it('logs a failed exit and a failed navigation instead of leaving them unhandled', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitError = new Error('exit refused');
      const navigationError = new Error('navigation aborted');
      const replace = vi.fn().mockRejectedValue(navigationError);
      let backHandler: (() => void) | undefined;

      vi.mocked(CapacitorApp.addListener).mockImplementation(async (_event, handler) => {
        backHandler = handler as () => void;
        return { remove: vi.fn().mockResolvedValue(undefined) };
      });
      vi.mocked(CapacitorApp.exitApp).mockRejectedValue(exitError);

      await listen({
        currentRoute: { value: { name: 'inbox', meta: {} } },
        replace,
      } as never);
      backHandler?.();
      await vi.waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to exit the app on hardware back',
          exitError,
        ),
      );

      await listen({
        currentRoute: { value: { name: 'operations', meta: {} } },
        replace,
      } as never);
      backHandler?.();
      await vi.waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to navigate to inbox on hardware back',
          navigationError,
        ),
      );

      consoleError.mockRestore();
    });

    it('logs a failed navigation to the parent page instead of leaving it unhandled', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('navigation aborted');
      let backHandler: (() => void) | undefined;

      vi.mocked(CapacitorApp.addListener).mockImplementation(async (_event, handler) => {
        backHandler = handler as () => void;
        return { remove: vi.fn() };
      });

      await listen({
        currentRoute: { value: { name: 'capture-apps', meta: { backTo: 'capture' } } },
        options: { history: { state: { back: null } } },
        replace: vi.fn().mockRejectedValue(error),
      } as never);

      backHandler?.();

      await vi.waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to navigate to the parent page on hardware back',
          error,
        ),
      );
      consoleError.mockRestore();
    });
  });
});
