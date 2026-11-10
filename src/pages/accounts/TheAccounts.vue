<script setup lang="ts">
import { Wallet } from '@lucide/vue';
import EmptyState from '@/components/EmptyState.vue';
</script>

<template>
  <div class="py-4">
    <EmptyState
      :icon="Wallet"
      title="Счетов пока нет"
      description="Здесь будут карты, наличные и их остатки."
    />
  </div>
</template>
