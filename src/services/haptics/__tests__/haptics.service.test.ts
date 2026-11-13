import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import {
  setHapticsEnabled,
  vibrateError,
  vibrateSuccess,
  vibrateTick,
} from '@/services/haptics/haptics.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
  },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));

describe('haptics.service', () => {
  beforeEach(() => {
    setHapticsEnabled(true);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.impact).mockResolvedValue();
    vi.mocked(Haptics.notification).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fires a light impact for a tick', () => {
    vibrateTick();

    expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
  });

  it('fires a success notification', () => {
    vibrateSuccess();

    expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Success });
  });

  it('fires an error notification', () => {
    vibrateError();

    expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Error });
  });

  it('does not touch the plugin on web', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    vibrateTick();
    vibrateSuccess();
    vibrateError();

    expect(Haptics.impact).not.toHaveBeenCalled();
    expect(Haptics.notification).not.toHaveBeenCalled();
  });

  it('does not touch the plugin when haptics are disabled', () => {
    setHapticsEnabled(false);

    vibrateTick();
    vibrateSuccess();
    vibrateError();

    expect(Haptics.impact).not.toHaveBeenCalled();
    expect(Haptics.notification).not.toHaveBeenCalled();
  });

  it('swallows a rejected plugin call and logs it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Haptics.impact).mockRejectedValue(new Error('no vibrator'));

    expect(() => vibrateTick()).not.toThrow();

    // The service is intentionally sync, so flush the microtask queue before asserting
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
