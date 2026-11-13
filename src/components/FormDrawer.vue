<script setup lang="ts">
import { CheckIcon, Lock, TrashIcon, XIcon } from '@lucide/vue';
import Button from 'primevue/button';
import Drawer from 'primevue/drawer';

import {
  useHardwareBackHandler,
  HARDWARE_BACK_PRIORITY_FORM_DRAWER,
} from '@/services/hardwareBack';

import { computed, onUnmounted, ref, watch } from 'vue';

import type { Component } from 'vue';

// `deleteLabel`: what a screen reader calls the delete button. A caller that gives it another
// action's icon names that action, or TalkBack would read it as a deletion.
// `saving`: the caller is writing the form, so only the caller may close it.
const {
  modelValue,
  header,
  showDelete = false,
  deleteIcon = TrashIcon,
  deleteLabel = 'Удалить',
  readonly = false,
  saving = false,
} = defineProps<{
  modelValue: boolean;
  header: string;
  showDelete?: boolean;
  deleteIcon?: Component;
  deleteLabel?: string;
  readonly?: boolean;
  saving?: boolean;
}>();

const emit = defineEmits<{
  'update:model-value': [value: boolean];
  save: [];
  delete: [];
}>();

const isContentMounted = ref(false);

let contentFrame: number | null = null;

const visible = computed({
  get: () => modelValue,
  set: value => emit('update:model-value', value),
});

useHardwareBackHandler({
  priority: HARDWARE_BACK_PRIORITY_FORM_DRAWER,
  isActive: () => visible.value,
  // Stays active while saving, so the press is taken here and not by the page under the form
  onBack: () => {
    if (saving) return;

    visible.value = false;
  },
});

// The sheet slides in on its header alone and takes the form a frame later. Mounting the fields,
// their pickers and the loads those start in the same tick as the drawer blocks the first painted
// frame, and the sheet lands in place instead of sliding into it. Measured on the production build,
// tap to first frame: 126 ms -> 21 ms at CPU x6, 18 ms -> 3 ms unthrottled; the fields land 19 ms
// later than they used to (146 ms at x6), about 40% into the 300 ms slide, so the sheet is never
// seen empty. It is full-screen, so waiting costs no geometry either.
// Two frames, because the first callback still runs before the paint it was scheduled from.
// Closing leaves the form mounted, or the sheet would slide out empty.
watch(
  () => modelValue,
  open => {
    cancelContentFrame();
    if (!open) return;

    isContentMounted.value = false;
    contentFrame = window.requestAnimationFrame(() => {
      contentFrame = window.requestAnimationFrame(mountContent);
    });
  },
  { immediate: true },
);

onUnmounted(cancelContentFrame);

// The Drawer keeps its buttons mounted until the leave animation ends, so a tap can still land on
// a form the caller has just saved and closed: it would validate the filled form and write again.
function onSave() {
  if (saving || !visible.value) return;

  emit('save');
}

function onDelete() {
  if (saving || !visible.value) return;

  emit('delete');
}

function mountContent() {
  contentFrame = null;
  isContentMounted.value = true;
}

function cancelContentFrame() {
  if (contentFrame === null) return;

  window.cancelAnimationFrame(contentFrame);
  contentFrame = null;
}
</script>

<template>
  <!-- The drawer root scrolls itself, so the scrollbar rides the edge of the sheet instead of a
       padded body inside it, and the header sticks to the top of the sheet. `#container` replaces
       the flex layout the root ships with, hence `block`. `scroll-pt-20` is the tallest header
       (two title lines plus its paddings and rule): without it the browser parks a field focused
       from off-screen behind the sticky header.

       The header sits a layer above the fields (`z-20` over their `z-10`): a clear button is
       positioned and comes later in the DOM, so on an equal z-index it would paint over the header
       it scrolls under. App chrome stays above both at `z-40`.

       With `#container` PrimeVue names nothing, so TalkBack would announce a bare dialog: the title
       goes to the root as its `aria-label`. -->
  <Drawer
    v-model:visible="visible"
    :close-on-escape="!saving"
    position="right"
    :pt="{
      root: {
        class: 'bg-app block w-full scroll-pt-20 overflow-y-auto',
        'aria-label': header,
      },
    }"
  >
    <template #container="{ closeCallback }">
      <div class="bg-app px-column-4 sticky top-0 z-20 pt-4">
        <div class="flex items-center">
          <Button
            :disabled="saving"
            class="text-muted-color rounded-full p-1"
            variant="text"
            aria-label="Закрыть"
            @click="closeCallback"
          >
            <XIcon />
          </Button>

          <!-- No explicit size: inherits the body scale exactly like HeaderShell's h1 -->
          <h2 class="mr-auto ml-2 line-clamp-2 min-w-0 leading-tight font-semibold">
            {{ header }}
          </h2>

          <Button
            v-if="showDelete"
            :disabled="saving"
            :aria-label="deleteLabel"
            class="mr-1 rounded-full p-1"
            variant="text"
            @click="onDelete"
          >
            <component :is="deleteIcon" />
          </Button>

          <Lock
            v-if="readonly"
            class="text-muted-color m-1 shrink-0"
            role="img"
            aria-label="Только просмотр"
          />

          <Button
            v-else
            :disabled="saving"
            class="rounded-full p-1"
            variant="text"
            aria-label="Сохранить"
            @click="onSave"
          >
            <CheckIcon />
          </Button>
        </div>

        <hr class="text-line mt-4" />
      </div>

      <div
        class="px-column-4 pt-4"
        :style="{ paddingBottom: 'calc(1rem + var(--keyboard-height, 0px))' }"
      >
        <slot v-if="isContentMounted" />
      </div>
    </template>
  </Drawer>
</template>
