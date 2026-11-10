import type { PreferenceKey } from './preferences.types';

// Every key the app keeps in Capacitor Preferences. Nothing reads or writes the plugin with a key
// that is not listed here, so this is the whole answer to "what lives in Preferences" and to which
// side each entry belongs. The dark-mode mirror in localStorage (`services/theme`) is not a
// preference: index.html reads it synchronously before the plugin is available.
export const PREFERENCE_KEYS = {
  darkMode: { key: 'settingsThemeDarkMode', scope: 'device' },
} as const satisfies Record<string, PreferenceKey>;
