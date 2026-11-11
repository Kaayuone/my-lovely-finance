<script setup lang="ts">
import { formatCaptureTime } from '../utils';
import type { SkippedNotification } from '@/services/capture';

const { skipped } = defineProps<{ skipped: SkippedNotification[] }>();
</script>

<template>
  <section class="flex flex-col gap-2">
    <h2 class="text-muted-color px-1 text-sm font-semibold">Отброшено: нет суммы</h2>
    <p class="text-muted-color px-1 text-xs">
      Уведомления выбранных приложений, в которых не нашлось суммы в валюте. Текст не сохраняется —
      только приложение и время. Если здесь оказалась покупка, сумма в её уведомлении записана
      непривычно: перешлите текст из шторки или приложения банка.
    </p>
    <p v-if="!skipped.length" class="bg-card text-muted-color rounded-xl p-4 text-sm">
      Пока ничего не отброшено.
    </p>
    <ul v-else class="bg-card divide-line flex flex-col divide-y rounded-xl">
      <li v-for="notification in skipped" :key="notification.id" class="flex gap-3 px-4 py-2.5">
        <span class="text-color min-w-0 flex-1 text-sm break-words">
          {{ notification.appLabel }}
        </span>
        <span class="text-muted-color shrink-0 text-xs">
          {{ formatCaptureTime(notification.postedAt) }}
        </span>
      </li>
    </ul>
  </section>
</template>
