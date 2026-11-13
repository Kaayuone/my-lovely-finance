<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner';

const { label = 'Загружаем данные…' } = defineProps<{
  label?: string;
}>();
</script>

<template>
  <div
    class="text-muted-color flex items-center justify-center gap-2 text-sm"
    role="status"
    aria-live="polite"
  >
    <ProgressSpinner class="size-5!" stroke-width="6" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>
