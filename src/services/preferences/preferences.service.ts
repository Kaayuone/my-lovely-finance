import { Preferences } from '@capacitor/preferences';

import type { PreferenceKey } from './preferences.types';

// The only place that talks to the plugin: values are strings, the callers own their codecs
export async function getPreference(preference: PreferenceKey): Promise<string | null> {
  const { value } = await Preferences.get({ key: preference.key });
  return value;
}

export async function setPreference(preference: PreferenceKey, value: string): Promise<void> {
  await Preferences.set({ key: preference.key, value });
}

export async function removePreference(preference: PreferenceKey): Promise<void> {
  await Preferences.remove({ key: preference.key });
}
