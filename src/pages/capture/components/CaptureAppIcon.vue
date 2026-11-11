<script setup lang="ts">
const { icon } = defineProps<{ icon: string | null }>();
</script>

<template>
  <!-- Decorative: the label of the app always stands next to it -->
  <img v-if="icon" :src="icon" alt="" class="size-10 shrink-0 rounded-lg" />
  <span v-else class="bg-field size-10 shrink-0 rounded-lg" aria-hidden="true" />
</template>
