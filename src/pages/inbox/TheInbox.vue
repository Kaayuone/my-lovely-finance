<script setup lang="ts">
import { Inbox } from '@lucide/vue';
import EmptyState from '@/components/EmptyState.vue';
</script>

<template>
  <div class="py-4">
    <EmptyState
      :icon="Inbox"
      title="Черновиков пока нет"
      description="Сюда попадут операции из уведомлений банков — останется подтвердить их одним касанием."
    />
  </div>
</template>
