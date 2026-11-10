<script setup lang="ts">
import Button from 'primevue/button';
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
    <ul v-else class="flex flex-col gap-1">
      <li v-for="app in sources" :key="app.packageName" class="text-color text-sm break-words">
        {{ app.label }}
      </li>
    </ul>
    <Button label="Выбрать приложения" severity="secondary" outlined @click="onChooseApps" />
  </section>
</template>
