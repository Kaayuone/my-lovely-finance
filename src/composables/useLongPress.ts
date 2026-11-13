import { onUnmounted } from 'vue';
import { vibrateTick } from '@/services/haptics';
import {
  LONG_PRESS_DELAY_MS,
  LONG_PRESS_RELEASE_GUARD_MS,
  POINTER_DRAG_START_SHIFT_PX,
} from '@/constants/gestures';

export type LongPressListeners = {
  pointerdown: (event: PointerEvent) => void;
  pointermove: (event: PointerEvent) => void;
  pointerup: (event: PointerEvent) => void;
  pointercancel: (event: PointerEvent) => void;
  lostpointercapture: (event: PointerEvent) => void;
  touchend: (event: TouchEvent) => void;
  contextmenu: (event: Event) => void;
};

interface LongPressOptions<T> {
  onLongPress: (item: T) => void;
  // Read when the press fires, not when it starts. Defaults to always enabled
  isEnabled?: (item: T) => boolean;
}

// A held row of a list: `v-on="bindLongPress(item)"` next to the row's own click. The press is timed
// here rather than taken from `contextmenu`: the WebView fires that one on its own schedule (400 ms,
// up to 1500 ms with accessibility settings) and a mouse only on the right button, while the row
// needs one delay everywhere. The row is never captured and nothing of the touch is cancelled before
// the press fires, so scrolling the list stays with the browser.
export function useLongPress<T>(options: LongPressOptions<T>) {
  let pressTimer: number | null = null;
  let pressPointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let swallowing = false;
  let firedPointerId: number | null = null;
  // Chromium sends `touchend` after `pointerup` of the same touch, so the fired press outlives it
  let touchEndPending = false;
  let releaseGuardTimer: number | null = null;

  function bindLongPress(item: T): LongPressListeners {
    return {
      pointerdown: event => startPress(item, event),
      pointermove: onPointerMove,
      pointerup: onPressPointerEnd,
      pointercancel: onPressPointerEnd,
      lostpointercapture: onPressPointerEnd,
      touchend: onTouchEnd,
      // Even when the gesture is off: the WebView would select the text and open its own menu
      contextmenu: event => event.preventDefault(),
    };
  }

  // A touch keeps sending its moves and its release to the row it pressed, a mouse does not: moved
  // off the row, it sends them elsewhere. So for
  // as long as the press runs its pointer is followed on the window too
  function startPress(item: T, event: PointerEvent) {
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    cancelPress();
    stopSwallowing();
    startX = event.clientX;
    startY = event.clientY;
    const { pointerId } = event;
    pressPointerId = pointerId;
    pressTimer = window.setTimeout(() => {
      cancelPress();
      firePress(item, pointerId);
    }, LONG_PRESS_DELAY_MS);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPressPointerEnd, true);
    window.addEventListener('pointercancel', onPressPointerEnd, true);
  }

  function firePress(item: T, pointerId: number) {
    if (options.isEnabled && !options.isEnabled(item)) return;

    startSwallowing(pointerId);
    // A selection the WebView's own long press has already started
    window.getSelection()?.removeAllRanges();
    vibrateTick();
    options.onLongPress(item);
  }

  // Cancel on the move itself, before a browser scroll can turn the hold into a long press
  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pressPointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (
      Math.abs(dx) >= POINTER_DRAG_START_SHIFT_PX ||
      Math.abs(dy) >= POINTER_DRAG_START_SHIFT_PX
    ) {
      cancelPress();
    }
  }

  function onPressPointerEnd(event: PointerEvent) {
    if (event.pointerId === pressPointerId) cancelPress();
  }

  function cancelPress() {
    if (pressPointerId === null) return;

    if (pressTimer !== null) window.clearTimeout(pressTimer);
    pressTimer = null;
    pressPointerId = null;
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPressPointerEnd, true);
    window.removeEventListener('pointercancel', onPressPointerEnd, true);
  }

  // A cancelled `touchend` makes Chromium send neither the click nor the compatibility mouse events
  function onTouchEnd(event: TouchEvent) {
    if (!touchEndPending) return;

    touchEndPending = false;
    if (event.cancelable) event.preventDefault();
    armReleaseGuard();
  }

  // The release of a fired press must not reach the page: its click would open the row under the
  // finger, and the compatibility `mousedown` of a touch would close the sheet just opened, whose
  // mask closes on that event. A touch drops them with its cancelled `touchend`; a mouse (dev, E2E)
  // sends `mouseup` and `click` right after `pointerup`, so they are swallowed on the window in
  // capture. The swallowing ends with the next press anywhere and a short while after the release or
  // the cancellation of the press, never later: a TalkBack double tap arrives as a bare click with no
  // press before it, and an open-ended swallowing would eat the sheet's actions and every tap after.
  function startSwallowing(pointerId: number) {
    firedPointerId = pointerId;
    touchEndPending = true;
    if (swallowing) return;

    swallowing = true;
    window.addEventListener('pointerdown', stopSwallowing, true);
    window.addEventListener('pointerup', onFiredPointerEnd, true);
    window.addEventListener('pointercancel', onFiredPointerEnd, true);
    window.addEventListener('mousedown', swallowEvent, true);
    window.addEventListener('mouseup', swallowEvent, true);
    window.addEventListener('click', swallowEvent, true);
    // The WebView's own long press may land after ours, when the finger is over the sheet's mask
    // rather than the row: its menu and the text selection it starts are cancelled on the window
    window.addEventListener('contextmenu', cancelDefault, true);
    window.addEventListener('selectstart', cancelDefault, true);
  }

  function stopSwallowing() {
    clearReleaseGuard();
    firedPointerId = null;
    touchEndPending = false;
    if (!swallowing) return;

    swallowing = false;
    window.removeEventListener('pointerdown', stopSwallowing, true);
    window.removeEventListener('pointerup', onFiredPointerEnd, true);
    window.removeEventListener('pointercancel', onFiredPointerEnd, true);
    window.removeEventListener('mousedown', swallowEvent, true);
    window.removeEventListener('mouseup', swallowEvent, true);
    window.removeEventListener('click', swallowEvent, true);
    window.removeEventListener('contextmenu', cancelDefault, true);
    window.removeEventListener('selectstart', cancelDefault, true);
  }

  // Watched on the window: a mouse released over the sheet's mask sends `pointerup` there, not to
  // the row. A touch the system breaks off sends `pointercancel` and no `touchend`
  function onFiredPointerEnd(event: PointerEvent) {
    if (event.pointerId === firedPointerId) armReleaseGuard();
  }

  function swallowEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function cancelDefault(event: Event) {
    event.preventDefault();
  }

  function armReleaseGuard() {
    if (!swallowing) return;

    clearReleaseGuard();
    releaseGuardTimer = window.setTimeout(() => {
      releaseGuardTimer = null;
      stopSwallowing();
    }, LONG_PRESS_RELEASE_GUARD_MS);
  }

  function clearReleaseGuard() {
    if (releaseGuardTimer === null) return;

    window.clearTimeout(releaseGuardTimer);
    releaseGuardTimer = null;
  }

  onUnmounted(() => {
    cancelPress();
    stopSwallowing();
  });

  return { bindLongPress };
}
