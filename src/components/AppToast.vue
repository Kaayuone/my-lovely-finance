<script setup lang="ts">
import Toast from 'primevue/toast';

import { useToast } from 'primevue/usetoast';
import { usePointerDrag } from '@/composables/usePointerDrag';

import { ref } from 'vue';

import type { ToastEvent } from 'primevue/toast';
import type { VNode } from 'vue';

import { POINTER_DRAG_START_SHIFT_PX, SWIPE_COMMIT_SHIFT_PX } from '@/constants/gestures';

const SWIPE_SETTLE_MS = 200;

const toastRoot = ref<HTMLElement | null>(null);

let swipedMessage: HTMLElement | null = null;
let swipeShift = 0;
let draggedBeforeClick = false;

const toast = useToast();

// One surface for every message: the press finds its message, and only that one follows the finger
usePointerDrag(toastRoot, {
  isDrag: ({ dx, dy }) =>
    Math.abs(dx) >= POINTER_DRAG_START_SHIFT_PX && Math.abs(dx) > Math.abs(dy),
  onDown: ({ event }) => {
    draggedBeforeClick = false;
    swipeShift = 0;
    swipedMessage =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('.p-toast-message')
        : null;
  },
  onDrag: ({ dx }) => {
    swipeShift = dx;
    // `translate`, not `transform`: the leave animation of PrimeVue runs on `transform`, and the two
    // add up, so a swiped message fades out where the finger left it
    swipedMessage?.style.setProperty('translate', `${dx}px`);
  },
  onRelease: ({ dx, dragged }) => {
    // A tap closes through the message's own click, which also follows a drag and is skipped there
    draggedBeforeClick = dragged;
    if (!dragged || !swipedMessage) return;

    if (Math.abs(dx) < SWIPE_COMMIT_SHIFT_PX) {
      settleMessage(swipedMessage, dx);
      return;
    }

    // PrimeVue hands the message object only to its click handler, so a committed swipe ends
    // there as a tap does
    draggedBeforeClick = false;
    swipedMessage.click();
  },
  onCancel: () => {
    if (swipedMessage) settleMessage(swipedMessage, swipeShift);
  },
});

function closeMessage({ message }: ToastEvent) {
  if (draggedBeforeClick) {
    draggedBeforeClick = false;
    return;
  }

  toast.remove(message);
}

function settleMessage(message: HTMLElement, shift: number) {
  message.style.removeProperty('translate');
  message.animate([{ translate: `${shift}px` }, { translate: '0' }], {
    duration: SWIPE_SETTLE_MS,
    easing: 'ease-out',
  });
}

// The root is teleported by the portal of Toast, out of reach of a template ref: its vnode hooks
// hand the element over
function attachRoot({ el }: VNode) {
  toastRoot.value = el instanceof HTMLElement ? el : null;
}

function detachRoot() {
  toastRoot.value = null;
}
</script>

<template>
  <!--
    `touch-pan-y`: the browser keeps the vertical moves and leaves the sideways swipe to us.
    `pointer-events-none` on the root, `-auto` on a message that stays: the gaps and the place of a
    message fading out (the root keeps its height for a quarter of a second) pass the tap to the
    page, while the presses on a message still bubble up to the root for the swipe
  -->
  <Toast
    :pt="{
      root: {
        class: 'pointer-events-none max-w-[calc(100vw-2rem)] touch-pan-y',
        onVnodeMounted: attachRoot,
        onVnodeUnmounted: detachRoot,
      },
      message: {
        class: 'pointer-events-auto [&.p-toast-message-leave-active]:pointer-events-none',
      },
    }"
    position="top-center"
    @click="closeMessage"
  />
</template>
