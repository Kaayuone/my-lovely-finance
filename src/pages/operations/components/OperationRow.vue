<script setup lang="ts">
import { computed } from 'vue';
import { isMoneyIn } from '../utils';
import type { OperationRowView } from '../types';

const { row } = defineProps<{
  row: OperationRowView;
}>();

const amountClass = computed(() => (isMoneyIn(row.operation) ? 'text-primary' : 'text-color'));
</script>

<template>
  <!-- The tap and the long press come from the page through the attributes of the root -->
  <div
    role="button"
    class="active:bg-card flex items-start gap-3 rounded-md p-2 select-none [-webkit-touch-callout:none]"
  >
    <div class="min-w-0 flex-1">
      <p class="text-color line-clamp-1 leading-tight wrap-break-word">{{ row.title }}</p>
      <p class="text-muted-color mt-0.5 line-clamp-1 text-xs wrap-break-word">
        {{ row.subtitle }}
      </p>
      <p v-if="row.feeNote" class="text-muted-color mt-0.5 line-clamp-1 text-xs">
        {{ row.feeNote }}
      </p>
    </div>

    <!-- The amounts are never wrapped: the text gives way to them instead -->
    <div class="shrink-0 text-right">
      <p :class="amountClass" class="leading-tight font-medium whitespace-nowrap">
        {{ row.amount }}
      </p>
      <p v-if="row.creditAmount" class="text-color mt-0.5 text-xs whitespace-nowrap">
        {{ row.creditAmount }}
      </p>
    </div>
  </div>
</template>
