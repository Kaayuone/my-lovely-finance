import { defineStore } from 'pinia';
import { ref } from 'vue';

import { getPreference, PREFERENCE_KEYS, setPreference } from '@/services/preferences';
import { applyDarkMode, DEFAULT_DARK_MODE } from '@/services/theme';

export const useSettingsStore = defineStore('settings', () => {
  const darkMode = ref(DEFAULT_DARK_MODE);

  async function loadSettings() {
    const stored = await getPreference(PREFERENCE_KEYS.darkMode);
    darkMode.value = stored === null ? DEFAULT_DARK_MODE : stored === 'true';
    applyDarkMode(darkMode.value);
  }

  // The theme switches at once, before the write: a failed write leaves the choice for this run and
  // rejects, so the caller can say it was not saved
  async function setDarkMode(enabled: boolean) {
    darkMode.value = enabled;
    applyDarkMode(enabled, true);
    await setPreference(PREFERENCE_KEYS.darkMode, String(enabled));
  }

  return { darkMode, loadSettings, setDarkMode };
});
