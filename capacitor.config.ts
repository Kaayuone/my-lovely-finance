import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The Play package name: it cannot change once the app is published
  appId: 'my.lovely.finance',
  appName: 'My Lovely Finance',
  webDir: 'dist',
  android: {
    // Tailwind v4 needs Chrome 111 for color-mix()/oklch(); below it the bundle renders blank
    minWebViewVersion: 111,
  },
  server: {
    // Capacitor loads this page instead of the app below that minimum, and on main-frame load errors
    errorPath: 'webview-outdated.html',
  },
};

export default config;
