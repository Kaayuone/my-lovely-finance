<script setup lang="ts">
import { vibrateTick } from '@/services/haptics';
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5; // odd, so exactly one row sits in the centre
const SETTLE_MS = 120; // scroll silence before the centred row is committed

const { options } = defineProps<{
  options: { label: string; value: number }[];
  label: string;
}>();

const model = defineModel<number>({ required: true });

const listRef = useTemplateRef<HTMLElement>('listRef');

let settleTimer: ReturnType<typeof setTimeout> | null = null;
let lastTickIndex = 0; // matches the initial scrollTop of 0, so mounting never ticks

watch(model, value => {
  if (value !== centeredValue()) scrollToValue(value);
});

onMounted(() => {
  // The wheel mounts together with its dialog, so wait for layout before scrolling.
  requestAnimationFrame(() => scrollToValue(model.value));
});

onBeforeUnmount(() => {
  if (settleTimer) clearTimeout(settleTimer);
});

function centeredIndex() {
  if (!listRef.value) return -1;

  const index = Math.round(listRef.value.scrollTop / ITEM_HEIGHT);
  return Math.min(options.length - 1, Math.max(0, index));
}

function centeredValue() {
  return options[centeredIndex()]?.value;
}

function scrollToValue(value: number, smooth = false) {
  const index = Math.max(
    0,
    options.findIndex(option => option.value === value),
  );
  // Instant jumps are programmatic (mount / model sync) and must not tick
  if (!smooth) lastTickIndex = index;
  listRef.value?.scrollTo({
    top: index * ITEM_HEIGHT,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function commit() {
  const value = centeredValue();
  if (value !== undefined && value !== model.value) model.value = value;
}

function onScroll() {
  const index = centeredIndex();
  if (index !== lastTickIndex) {
    lastTickIndex = index;
    vibrateTick();
  }
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(commit, SETTLE_MS);
}
</script>

<template>
  <div
    class="relative"
    :style="{
      '--wheel-item-height': `${ITEM_HEIGHT}px`,
      '--wheel-pad-height': `${((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT}px`,
      height: `${VISIBLE_ITEMS * ITEM_HEIGHT}px`,
    }"
  >
    <div
      class="wheel-band bg-line/60 pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-lg"
    />

    <div
      ref="listRef"
      class="wheel-list h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      role="listbox"
      :aria-label="label"
      @scroll="onScroll"
    >
      <div class="wheel-pad" />

      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="wheel-item flex w-full snap-center items-center justify-center tabular-nums"
        :class="option.value === model ? 'text-primary font-semibold' : 'text-muted-color'"
        role="option"
        :aria-selected="option.value === model"
        @click="scrollToValue(option.value, true)"
      >
        {{ option.label }}
      </button>

      <div class="wheel-pad" />
    </div>
  </div>
</template>

<style scoped>
.wheel-list {
  scrollbar-width: none;
  /* Prefixed too: unprefixed mask-image landed only in Chrome 120, minSdk here is 24 */
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent);
}

.wheel-list::-webkit-scrollbar {
  display: none;
}

.wheel-item,
.wheel-band {
  height: var(--wheel-item-height);
}

/* Keeps the first and the last option reachable at the centre of the wheel */
.wheel-pad {
  height: var(--wheel-pad-height);
}
</style>
