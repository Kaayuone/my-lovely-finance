import './assets/fonts/lato.css';
import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import { definePreset } from '@primeuix/themes';
import { ru } from 'primelocale/js/ru.js';

import App from './App.vue';
import router from './router';

import VirtualScroller from 'vue-virtual-scroller';
import 'vue-virtual-scroller/index.css';

import { startDatabase } from '@/services/startup';
import { buildPrimaryRamp, DEFAULT_ACCENT_COLOR } from '@/services/theme';
import { useSettingsStore } from '@/stores/settingsStore';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(VirtualScroller);

const preset = definePreset(Aura, {
  semantic: {
    primary: buildPrimaryRamp(DEFAULT_ACCENT_COLOR),
  },
});

app.use(PrimeVue, {
  locale: ru,
  theme: {
    preset,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: {
        name: 'primevue',
        order: 'theme, base, primevue',
      },
    },
  },
  ripple: true,
});
app.use(ToastService);
app.directive('ripple', Ripple);

async function bootstrap() {
  await startDatabase();

  // Settings are non-critical: on failure keep defaults so the app still mounts
  try {
    await useSettingsStore(pinia).loadSettings();
  } catch (error) {
    console.error('Failed to load settings', error);
  }

  app.mount('#app');
}

// Deliberately not awaited at module scope. The jeep-sqlite loader is a chunk of its own, but it
// imports this entry chunk back for the preload helper: a top-level await here would leave the
// entry module evaluating, the loader chunk would wait on it, the component would never hydrate
// and the web store this bootstrap waits for would never open. The dev server keeps the modules
// separate, so the deadlock only shows up in a production build.
void bootstrap();
