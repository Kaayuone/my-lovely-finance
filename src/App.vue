<script setup lang="ts">
import { RouterView } from 'vue-router';
import DatabaseErrorScreen from '@/components/DatabaseErrorScreen.vue';
import { dbInitStatus } from '@/database/bootstrap';
</script>

<template>
  <!-- main.ts mounts the app once the database has opened or failed, so `pending` never renders -->
  <DatabaseErrorScreen v-if="dbInitStatus === 'failed'" />

  <RouterView v-else-if="dbInitStatus === 'ready'" />
</template>
