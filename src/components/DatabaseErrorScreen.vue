<script setup lang="ts">
import Button from 'primevue/button';
import { startDatabase } from '@/services/startup';
import { ref } from 'vue';

const isRetrying = ref(false);

async function onRetry() {
  isRetrying.value = true;
  try {
    await startDatabase();
  } finally {
    isRetrying.value = false;
  }
}
</script>

<template>
  <div class="bg-app flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
    <p class="text-color text-lg font-medium">Не удалось инициализировать базу данных</p>
    <Button :loading="isRetrying" label="Повторить" @click="onRetry" />
  </div>
</template>
