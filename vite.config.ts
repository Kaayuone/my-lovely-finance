import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import VueDevTools from 'vite-plugin-vue-devtools';
import tailwindcss from '@tailwindcss/vite';

import { version } from './package.json';

export default defineConfig({
  // The version lives only in package.json: Gradle reads it from there and so does the bundle
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [vue(), VueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // The licenses of every npm package in the bundle ship with the build as a file;
    // public/third-party-notices.txt covers what the bundle graph does not show. Not the default
    // `.vite/license.md`: the Android build leaves dot folders out of the APK (ignoreAssetsPattern
    // of the Capacitor template in android/app/build.gradle)
    license: { fileName: 'licenses.json' },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/__tests__/**'],
      // Thresholds are set per module once a module has a baseline worth guarding: the ones whose
      // invariants lose user data or money silently come first (database, entities, stores)
    },
  },
});
