<script setup lang="ts">
import Button from 'primevue/button';
import CaptureAppIcon from './CaptureAppIcon.vue';
import { useRouter } from 'vue-router';
import type { CaptureApp } from '@/services/capture';

const { sources } = defineProps<{ sources: CaptureApp[] }>();

const router = useRouter();

function onChooseApps() {
  void router.push({ name: 'capture-apps' });
}
</script>

<template>
  <section class="bg-card flex flex-col gap-3 rounded-xl p-4">
    <h2 class="text-color font-semibold">Приложения</h2>
    <p v-if="!sources.length" class="text-muted-color text-sm">
      Не выбрано ни одного — собирать нечего. Выберите приложения своих банков и SMS.
    </p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="app in sources" :key="app.packageName" class="flex items-center gap-3">
        <CaptureAppIcon :icon="app.icon" />
        <span class="text-color min-w-0 text-sm break-words">{{ app.label }}</span>
      </li>
    </ul>
    <p class="text-muted-color text-sm">
      Сохраняются только уведомления с суммой в валюте: переписка без сумм не записывается.
    </p>
    <Button label="Выбрать приложения" severity="secondary" outlined @click="onChooseApps" />
  </section>
</template>
