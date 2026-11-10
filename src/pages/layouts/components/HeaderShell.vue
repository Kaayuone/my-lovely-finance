<script setup lang="ts">
const { title } = defineProps<{ title?: string }>();
</script>

<template>
  <header class="bg-card px-column-4 flex h-16 w-full items-center gap-2 py-2.5">
    <slot name="content">
      <h1 class="text-primary line-clamp-2 min-w-0 flex-1 leading-tight font-bold">{{ title }}</h1>
    </slot>

    <slot />
  </header>
</template>
