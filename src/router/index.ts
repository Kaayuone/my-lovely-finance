import { createRouter, createWebHistory } from 'vue-router';
import TheAccounts from '@/pages/accounts/TheAccounts.vue';
import TheInbox from '@/pages/inbox/TheInbox.vue';
import DefaultLayout from '@/pages/layouts/DefaultLayout.vue';
import TheOperations from '@/pages/operations/TheOperations.vue';
import TheSettings from '@/pages/settings/TheSettings.vue';

import type { RouteRecordRaw } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    // Page title rendered by DefaultHeader
    title?: string;
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
        meta: { title: 'Операции' },
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
