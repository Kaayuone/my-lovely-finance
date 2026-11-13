<script setup lang="ts">
const { message } = defineProps<{ message?: string }>();
</script>

<template>
  <!-- data-field-error marks the scroll target for a rule that belongs to no single field -->
  <small v-if="message" data-field-error class="text-invalid text-xs">{{ message }}</small>
</template>
