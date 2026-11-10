<script setup lang="ts">
import { computed } from 'vue';
import { bootHint, formatCaptureTime } from '../utils';
import type { ListenerEvent } from '@/services/capture';
import { LISTENER_EVENT_LABELS } from '../constants';

const { events } = defineProps<{ events: ListenerEvent[] }>();

const rows = computed(() =>
  events.map(event => ({
    id: event.id,
    label: LISTENER_EVENT_LABELS[event.kind],
    time: formatCaptureTime(event.at),
    hint: bootHint(event.uptimeMs),
  })),
);
</script>

<template>
  <section class="flex flex-col gap-2">
    <h2 class="text-muted-color px-1 text-sm font-semibold">События службы</h2>
    <p v-if="!rows.length" class="bg-card text-muted-color rounded-xl p-4 text-sm">
      Служба ещё ни разу не подключалась.
    </p>
    <ul v-else class="bg-card divide-line flex flex-col divide-y rounded-xl">
      <li v-for="row in rows" :key="row.id" class="flex items-baseline gap-3 px-4 py-2.5">
        <div class="min-w-0 flex-1">
          <p class="text-color text-sm">{{ row.label }}</p>
          <p v-if="row.hint" class="text-muted-color text-xs">{{ row.hint }}</p>
        </div>
        <span class="text-muted-color shrink-0 text-xs">{{ row.time }}</span>
      </li>
    </ul>
  </section>
</template>
