import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const capture = vi.hoisted(() => ({
  isCaptureSupported: vi.fn(),
  getCaptureStatus: vi.fn(),
  getCaptureSources: vi.fn(),
  getCapturedNotifications: vi.fn(),
  getLaunchableApps: vi.fn(),
  getListenerEvents: vi.fn(),
  setCaptureSourceEnabled: vi.fn(),
}));

vi.mock('@/services/capture', () => ({
  ...capture,
  CAPTURE_JOURNAL_NOTIFICATIONS_LIMIT: 50,
  CAPTURE_JOURNAL_EVENTS_LIMIT: 30,
}));

import { useCaptureStore } from '@/stores/captureStore';

beforeEach(() => {
  setActivePinia(createPinia());
  Object.values(capture).forEach(mock => mock.mockReset());
});

describe('captureStore', () => {
  it('never reaches the native plugin on the web', async () => {
    capture.isCaptureSupported.mockReturnValue(false);
    const store = useCaptureStore();

    await Promise.all([
      store.loadStatus(),
      store.loadSources(),
      store.loadJournal(),
      store.loadApps(),
    ]);

    expect(store.supported).toBe(false);
    expect(store.status).toBeNull();
    expect(capture.getCaptureStatus).not.toHaveBeenCalled();
    expect(capture.getCaptureSources).not.toHaveBeenCalled();
    expect(capture.getCapturedNotifications).not.toHaveBeenCalled();
    expect(capture.getLaunchableApps).not.toHaveBeenCalled();
  });

  it('lists the apps in Russian alphabetical order regardless of case', async () => {
    capture.isCaptureSupported.mockReturnValue(true);
    capture.getLaunchableApps.mockResolvedValue([
      { packageName: 'b', label: 'Сообщения' },
      { packageName: 'c', label: 'Банк' },
      { packageName: 'a', label: 'альфа' },
    ]);
    const store = useCaptureStore();

    await store.loadApps();

    expect(store.apps.map(app => app.label)).toEqual(['альфа', 'Банк', 'Сообщения']);
    expect(store.appsLoading).toBe(false);
  });
});
