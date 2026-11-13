<script setup lang="ts">
import { Plus } from '@lucide/vue';
import Button from 'primevue/button';
import type { Component } from 'vue';

const { label, icon = Plus } = defineProps<{
  label: string;
  icon?: Component;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <Button
    :aria-label="label"
    class="bg-primary w360:p-2.5 right-column-4 fixed! bottom-20 block rounded-full p-2"
    @click="emit('click')"
  >
    <component :is="icon" class="w360:size-6 size-5" />
  </Button>
</template>
