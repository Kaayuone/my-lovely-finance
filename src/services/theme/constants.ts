import type { AccentColor } from './theme.types';

// Must match the class used by `darkModeSelector` in main.ts, the `dark` variant in main.css
// and the bootstrap script in index.html
export const DARK_MODE_CLASS = 'dark-mode';

// Mirror of the persisted setting, read synchronously by the bootstrap script in index.html
export const DARK_MODE_CACHE_KEY = 'themeDarkMode';

export const DEFAULT_DARK_MODE = true;

// Marks the colour-scheme switch so the app's own surfaces fade with the components; see main.css
export const THEME_TRANSITION_CLASS = 'theme-transition';

// Must match --theme-transition-duration in assets/main.css
export const THEME_TRANSITION_DURATION_MS = 250;

export const DEFAULT_ACCENT_COLOR: AccentColor = 'emerald';

export const RAMP_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
