import type { PaletteDesignToken } from '@primeuix/themes/types';
import type { AccentColor } from './theme.types';

import {
  DARK_MODE_CACHE_KEY,
  DARK_MODE_CLASS,
  RAMP_SHADES,
  THEME_TRANSITION_CLASS,
  THEME_TRANSITION_DURATION_MS,
} from './constants';

let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined;

// Accent names match Aura primitive palettes, so the ramp is built from token references
export function buildPrimaryRamp(accent: AccentColor): PaletteDesignToken {
  return Object.fromEntries(
    RAMP_SHADES.map((shade): [number, string] => [shade, `{${accent}.${shade}}`]),
  );
}

// The class is added in the same task as the colour-scheme swap on purpose: transitions start from
// the after-change style, so the new timing already applies to the values that changed with it.
function startThemeTransition() {
  const root = document.documentElement;
  root.classList.add(THEME_TRANSITION_CLASS);

  clearTimeout(themeTransitionTimer);
  themeTransitionTimer = setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS);
  }, THEME_TRANSITION_DURATION_MS);
}

export function applyDarkMode(enabled: boolean, animated = false) {
  // Opt-in so the stored theme applied before mount paints the first frame without a fade
  if (animated) startThemeTransition();

  document.documentElement.classList.toggle(DARK_MODE_CLASS, enabled);

  // Mirror the choice so index.html can paint the first frame before Preferences resolves
  try {
    localStorage.setItem(DARK_MODE_CACHE_KEY, String(enabled));
  } catch (error) {
    console.error('Failed to cache the dark mode setting', error);
  }
}
