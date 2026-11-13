import { createRouter, createWebHistory } from 'vue-router';
import TheAccounts from '@/pages/accounts/TheAccounts.vue';
import TheCapture from '@/pages/capture/TheCapture.vue';
import TheCaptureApps from '@/pages/capture/TheCaptureApps.vue';
import TheInbox from '@/pages/inbox/TheInbox.vue';
import DefaultLayout from '@/pages/layouts/DefaultLayout.vue';
import TheOperations from '@/pages/operations/TheOperations.vue';
import TheSettings from '@/pages/settings/TheSettings.vue';

import { CAPTURE_FEATURE_TITLE } from '@/constants/capture';

import type { RouteRecordRaw } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    // Page title rendered by DefaultHeader
    title?: string;
    // The bottom-bar tab a nested page belongs to; a top-level page is its own tab
    tab?: string;
    // The page the back button of the header leads to when there is no history entry to go back to
    backTo?: string;
    // The page is a list on `DynamicScroller`, which pads itself: DefaultLayout leaves `<main>` bare
    virtualScroller?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: 'inbox',
        component: TheInbox,
        meta: { title: 'Входящие' },
      },
      {
        path: '/operations',
        name: 'operations',
        component: TheOperations,
        meta: { title: 'Операции', virtualScroller: true },
      },
      {
        path: '/accounts',
        name: 'accounts',
        component: TheAccounts,
        meta: { title: 'Счета' },
      },
      {
        path: '/settings',
        name: 'settings',
        component: TheSettings,
        meta: { title: 'Настройки' },
      },
      {
        path: '/settings/capture',
        name: 'capture',
        component: TheCapture,
        meta: { title: CAPTURE_FEATURE_TITLE, tab: 'settings', backTo: 'settings' },
      },
      {
        path: '/settings/capture/apps',
        name: 'capture-apps',
        component: TheCaptureApps,
        meta: { title: 'Приложения', tab: 'settings', backTo: 'capture' },
      },
    ],
  },
  // A route without a name renders nothing, so a path no route matches lands on the start page
  { path: '/:pathMatch(.*)*', redirect: { name: 'inbox' } },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
