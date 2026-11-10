<script setup lang="ts">
import { formatCaptureTime, notificationBody } from '../utils';
import type { CapturedNotification } from '@/services/capture';

const { notifications } = defineProps<{ notifications: CapturedNotification[] }>();
</script>

<template>
  <section class="flex flex-col gap-2">
    <h2 class="text-muted-color px-1 text-sm font-semibold">Пойманные уведомления</h2>
    <p v-if="!notifications.length" class="bg-card text-muted-color rounded-xl p-4 text-sm">
      Пока ничего. Уведомление выбранного приложения появится здесь, как только придёт.
    </p>
    <!-- select-text: these texts are what the parser is tuned on, so the person can copy them -->
    <ul v-else class="bg-card divide-line flex flex-col divide-y rounded-xl">
      <li
        v-for="notification in notifications"
        :key="notification.id"
        class="flex min-w-0 flex-col gap-1 px-4 py-3 select-text"
      >
        <div class="text-muted-color flex flex-wrap items-center gap-x-2 text-xs">
          <span class="min-w-0 break-words">{{ notification.appLabel }}</span>
          <span>{{ formatCaptureTime(notification.postedAt) }}</span>
          <span v-if="notification.subText" class="min-w-0 break-words">
            {{ notification.subText }}
          </span>
          <span v-if="notification.origin === 'restored'" class="text-primary">
            пропущено, найдено в шторке
          </span>
        </div>
        <p v-if="notification.title" class="text-color font-semibold break-words">
          {{ notification.title }}
        </p>
        <p class="text-color text-sm break-words whitespace-pre-line">
          {{ notificationBody(notification) }}
        </p>
      </li>
    </ul>
  </section>
</template>
