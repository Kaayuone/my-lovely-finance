import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const { getPreference, setPreference, applyDarkMode } = vi.hoisted(() => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
  applyDarkMode: vi.fn(),
}));

vi.mock('@/services/preferences', () => ({
  PREFERENCE_KEYS: { darkMode: { key: 'settingsThemeDarkMode', scope: 'device' } },
  getPreference,
  setPreference,
}));

vi.mock('@/services/theme', () => ({
  DEFAULT_DARK_MODE: true,
  applyDarkMode,
}));

import { useSettingsStore } from '@/stores/settingsStore';

beforeEach(() => {
  setActivePinia(createPinia());
  getPreference.mockReset();
  setPreference.mockReset();
  applyDarkMode.mockReset();
});

describe('settingsStore', () => {
  it('starts dark when nothing is stored and applies it without a fade', async () => {
    getPreference.mockResolvedValue(null);
    const store = useSettingsStore();

    await store.loadSettings();

    expect(store.darkMode).toBe(true);
    expect(applyDarkMode).toHaveBeenCalledWith(true);
  });

  it('restores the stored light theme', async () => {
    getPreference.mockResolvedValue('false');
    const store = useSettingsStore();

    await store.loadSettings();

    expect(store.darkMode).toBe(false);
    expect(applyDarkMode).toHaveBeenCalledWith(false);
  });

  it('switches the theme with a fade and stores the choice', async () => {
    setPreference.mockResolvedValue(undefined);
    const store = useSettingsStore();

    await store.setDarkMode(false);

    expect(store.darkMode).toBe(false);
    expect(applyDarkMode).toHaveBeenCalledWith(false, true);
    expect(setPreference).toHaveBeenCalledWith(
      { key: 'settingsThemeDarkMode', scope: 'device' },
      'false',
    );
  });

  it('keeps the switched theme for this run when the write fails, and rejects', async () => {
    setPreference.mockRejectedValue(new Error('storage is full'));
    const store = useSettingsStore();

    await expect(store.setDarkMode(false)).rejects.toThrow('storage is full');

    expect(store.darkMode).toBe(false);
  });
});
