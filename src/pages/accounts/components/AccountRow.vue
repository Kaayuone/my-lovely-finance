<script setup lang="ts">
import { CreditCard, Wallet } from '@lucide/vue';
import { computed } from 'vue';
import { formatMoney } from '@/utils/money';
import type { Account } from '@/entities/account/account.types';

const {
  account,
  cardDigits,
  bankAppLabel = null,
  balanceMinor,
  muted = false,
} = defineProps<{
  account: Account;
  cardDigits: string[];
  bankAppLabel?: string | null;
  balanceMinor: number;
  // An archived account
  muted?: boolean;
}>();

const balance = computed(() =>
  formatMoney({ amountMinor: balanceMinor, currency: account.currency }),
);
const cardsText = computed(() => cardDigits.map(digits => `·${digits}`).join(' '));
</script>

<template>
  <!-- The tap and the long press come from the page through the attributes of the root -->
  <div
    role="button"
    class="flex items-center gap-3 px-4 py-3 select-none [-webkit-touch-callout:none]"
  >
    <component
      :is="account.type === 'card' ? CreditCard : Wallet"
      :size="20"
      class="text-muted-color shrink-0"
      aria-hidden="true"
    />

    <div class="min-w-0 flex-1">
      <p
        :class="muted ? 'text-muted-color' : 'text-color'"
        class="line-clamp-1 leading-tight wrap-break-word"
      >
        {{ account.name }}
      </p>

      <p v-if="cardsText || bankAppLabel" class="text-muted-color mt-0.5 flex gap-2 text-xs">
        <span v-if="cardsText" class="truncate">{{ cardsText }}</span>
        <span v-if="bankAppLabel" class="truncate">{{ bankAppLabel }}</span>
      </p>
    </div>

    <!-- The balance is never wrapped: a name gives way to it instead -->
    <span
      :class="muted ? 'text-muted-color' : 'text-color'"
      class="shrink-0 font-medium whitespace-nowrap"
    >
      {{ balance }}
    </span>
  </div>
</template>
