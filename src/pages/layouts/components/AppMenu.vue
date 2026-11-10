<script setup lang="ts">
import { ArrowLeftRight, Inbox, Settings, Wallet } from '@lucide/vue';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import Tabs from 'primevue/tabs';

import { useRoute, useRouter } from 'vue-router';

import { computed } from 'vue';

import type { Component } from 'vue';

type NavMenuItem = {
  text: string;
  value: string;
  iconComponent: Component;
};

const NAV_MENU_ITEMS: NavMenuItem[] = [
  { text: 'Входящие', value: 'inbox', iconComponent: Inbox },
  { text: 'Операции', value: 'operations', iconComponent: ArrowLeftRight },
  { text: 'Счета', value: 'accounts', iconComponent: Wallet },
  { text: 'Настройки', value: 'settings', iconComponent: Settings },
];

const route = useRoute();
const router = useRouter();

const activeTab = computed(() => route.name?.toString() ?? 'inbox');

function onUpdateActiveTab(value: string | number) {
  if (value === activeTab.value) return;

  void router.push({ name: value.toString() });
}
</script>

<template>
  <nav class="flex w-full justify-center">
    <Tabs
      :value="activeTab"
      :scrollable="false"
      :show-navigators="false"
      class="w-full"
      @update:value="onUpdateActiveTab"
    >
      <!-- Height is pinned so the bar stays in sync with DefaultLayout's `bottom-*`; the base
           tier drops the 8px that the icon and its margin shed below 360px. The inner wrappers
           size to their content by default, so without `h-full` the tabs hang at the top -->
      <TabList
        :pt="{ content: { class: 'h-full' }, tabList: { class: 'px-column-0 h-full' } }"
        class="w360:h-16.25 flex h-14.25 w-full"
      >
        <Tab
          v-for="tab in NAV_MENU_ITEMS"
          :key="tab.value"
          :value="tab.value"
          class="w360:px-0.5 w400:px-1 w-1/4 min-w-0 px-0 py-1.5"
        >
          <div class="flex h-full w-full min-w-0 flex-col items-center justify-center">
            <component :is="tab.iconComponent" class="w360:mb-2 w360:size-6 mb-1 size-5" />
            <!-- leading-tight, not leading-none: a 10px line box clips Cyrillic descenders
                 inside line-clamp's overflow: hidden -->
            <span
              class="text-2xs w360:tracking-normal line-clamp-1 w-full text-center leading-tight tracking-tight text-ellipsis"
              >{{ tab.text }}</span
            >
          </div>
        </Tab>
      </TabList>
    </Tabs>
  </nav>
</template>
