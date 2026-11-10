<script setup lang="ts">
import { BellOff } from '@lucide/vue';
import Checkbox from 'primevue/checkbox';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import EmptyState from '@/components/EmptyState.vue';

import { useCaptureStore } from '@/stores/captureStore';

import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';

const query = ref('');

const captureStore = useCaptureStore();
const { apps, appsLoading, sources } = storeToRefs(captureStore);

const selected = computed(() => new Set(sources.value.map(source => source.packageName)));

const visibleApps = computed(() => {
  const search = query.value.trim().toLocaleLowerCase('ru');
  if (!search) return apps.value;
  return apps.value.filter(
    app => app.label.toLocaleLowerCase('ru').includes(search) || app.packageName.includes(search),
  );
});

onMounted(async () => {
  try {
    await Promise.all([captureStore.loadApps(), captureStore.loadSources()]);
  } catch (error) {
    console.error('Failed to load the apps to capture from', error);
  }
});

// The checkbox follows the stored list: until the reload it keeps showing what is saved
async function onToggle(packageName: string, enabled: boolean) {
  try {
    await captureStore.setSourceEnabled(packageName, enabled);
  } catch (error) {
    console.error('Failed to change the apps to capture from', error);
  }
  try {
    await captureStore.loadSources();
  } catch (error) {
    console.error('Failed to reload the apps to capture from', error);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 py-4">
    <EmptyState
      v-if="!captureStore.supported"
      :icon="BellOff"
      title="Только на Android"
      description="Список приложений есть только у приложения на телефоне."
    />

    <template v-else>
      <p class="text-muted-color px-1 text-sm">
        Отметьте приложения своих банков и SMS: записываются только их уведомления.
      </p>

      <FloatLabel variant="on">
        <InputText id="capture-apps-search" v-model="query" fluid />
        <label for="capture-apps-search">Поиск</label>
      </FloatLabel>

      <p v-if="appsLoading" class="text-muted-color text-center text-sm">Загрузка…</p>
      <p v-else-if="!visibleApps.length" class="text-muted-color text-center text-sm">
        Ничего не найдено
      </p>
      <ul v-else class="bg-card divide-line flex flex-col divide-y rounded-xl">
        <li v-for="app in visibleApps" :key="app.packageName">
          <label :for="`capture-app-${app.packageName}`" class="flex items-center gap-3 px-4 py-3">
            <Checkbox
              :model-value="selected.has(app.packageName)"
              :input-id="`capture-app-${app.packageName}`"
              binary
              @update:model-value="onToggle(app.packageName, $event)"
            />
            <span class="min-w-0 flex-1">
              <span class="text-color block break-words">{{ app.label }}</span>
              <span class="text-muted-color block truncate text-xs">{{ app.packageName }}</span>
            </span>
          </label>
        </li>
      </ul>
    </template>
  </div>
</template>
