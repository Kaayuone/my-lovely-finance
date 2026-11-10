<script setup lang="ts">
import { ArrowLeftRight } from '@lucide/vue';
import EmptyState from '@/components/EmptyState.vue';
</script>

<template>
  <div class="py-4">
    <EmptyState
      :icon="ArrowLeftRight"
      title="Операций пока нет"
      description="Здесь будут доходы, расходы и переводы между счетами."
    />
  </div>
</template>
