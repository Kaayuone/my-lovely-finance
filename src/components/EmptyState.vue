<script setup lang="ts">
import type { Component } from 'vue';

const { icon, title, description } = defineProps<{
  icon: Component;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="bg-card mx-auto flex max-w-80 flex-col items-center gap-3 rounded-xl px-4 py-8 text-center"
  >
    <component :is="icon" class="text-primary size-10" aria-hidden="true" />

    <div>
      <p class="text-color font-semibold">{{ title }}</p>
      <p v-if="description" class="text-muted-color mt-1 text-sm">{{ description }}</p>
    </div>

    <slot name="action" />
  </div>
</template>
