import { ref, onUnmounted, watch } from 'vue';
import type { Ref } from 'vue';
import { POINTER_DRAG_SURFACE_ATTRIBUTE } from '@/constants/gestures';

export interface PointerDragState {
  dx: number; // clientX - press clientX
  dy: number; // clientY - press clientY
  event: PointerEvent;
}

interface PointerDragOptions {
  // Capture the pointer on press, or only once the move qualifies as a drag
  // (deferred capture lets taps reach child controls). Defaults to 'drag'.
  capture?: 'down' | 'drag';
  // Whether a move counts as a drag; below this it may still end as a tap.
  isDrag: (state: PointerDragState) => boolean;
  onDown?: (state: PointerDragState) => void;
  onDrag?: (state: PointerDragState) => void;
  onRelease?: (state: PointerDragState & { dragged: boolean }) => void;
  onCancel?: () => void;
}

// Pointer-based drag lifecycle (press → threshold → follow → release), shared by
// gestures that need to track the finger. Target may appear/disappear (lazily
// mounted content) — listeners are attached via watch.
export function usePointerDrag(target: Ref<HTMLElement | null>, options: PointerDragOptions) {
  const dragging = ref(false);

  let active = false;
  let startX = 0;
  let startY = 0;
  let attached: HTMLElement | null = null;
  let pendingMove: PointerEvent | null = null;
  let moveFrame: number | null = null;

  function stateOf(event: PointerEvent): PointerDragState {
    return { dx: event.clientX - startX, dy: event.clientY - startY, event };
  }

  function cancelPendingMove() {
    if (moveFrame !== null) cancelAnimationFrame(moveFrame);
    moveFrame = null;
    pendingMove = null;
  }

  function applyPointerMove(event: PointerEvent) {
    if (!active) return;

    const state = stateOf(event);
    if (!dragging.value) {
      if (!options.isDrag(state)) return;
      dragging.value = true;
      if (options.capture !== 'down') attached?.setPointerCapture(event.pointerId);
    }

    options.onDrag?.(state);
  }

  function flushPendingMove() {
    if (!pendingMove) return;

    if (moveFrame !== null) cancelAnimationFrame(moveFrame);
    const event = pendingMove;
    moveFrame = null;
    pendingMove = null;
    applyPointerMove(event);
  }

  function resetGesture() {
    cancelPendingMove();
    active = false;
    dragging.value = false;
    startX = 0;
    startY = 0;
  }

  function onPointerDown(event: PointerEvent) {
    if (!isOwnSurface(event.target)) return;

    cancelPendingMove();
    active = true;
    dragging.value = false;
    startX = event.clientX;
    startY = event.clientY;
    if (options.capture === 'down') attached?.setPointerCapture(event.pointerId);
    options.onDown?.(stateOf(event));
  }

  function onPointerMove(event: PointerEvent) {
    if (!active) return;

    pendingMove = event;
    if (moveFrame !== null) return;

    moveFrame = requestAnimationFrame(() => {
      moveFrame = null;
      const latestMove = pendingMove;
      pendingMove = null;
      if (latestMove) applyPointerMove(latestMove);
    });
  }

  function onPointerUp(event: PointerEvent) {
    if (!active) return;

    flushPendingMove();
    const state = stateOf(event);
    const dragged = dragging.value;
    resetGesture();
    options.onRelease?.({ ...state, dragged });
  }

  function onPointerCancel() {
    if (!active) return;

    const dragged = dragging.value;
    resetGesture();
    if (dragged) options.onCancel?.();
  }

  // Under `touch-action` the browser drops the scroll of a drag it was not allowed to take, but
  // still flings it on release: nothing moves, and the next tap anywhere only stops that fling.
  // Cancelling the touch moves of a drag keeps the browser out of the gesture, fling included.
  function onTouchMove(event: TouchEvent) {
    if (!active || !event.cancelable) return;

    // The move that turns the press into a drag is still waiting for its animation frame
    const pendingIsDrag = pendingMove !== null && options.isDrag(stateOf(pendingMove));
    if (dragging.value || pendingIsDrag) event.preventDefault();
  }

  // The innermost surface owns a press: a carousel nested in a swipeable page moves alone, and the
  // page does not follow the same finger
  function isOwnSurface(target: EventTarget | null) {
    if (!(target instanceof Element)) return true;

    return target.closest(`[${POINTER_DRAG_SURFACE_ATTRIBUTE}]`) === attached;
  }

  function detach() {
    resetGesture();
    if (!attached) return;

    attached.removeAttribute(POINTER_DRAG_SURFACE_ATTRIBUTE);
    attached.removeEventListener('pointerdown', onPointerDown);
    attached.removeEventListener('pointermove', onPointerMove);
    attached.removeEventListener('pointerup', onPointerUp);
    attached.removeEventListener('pointercancel', onPointerCancel);
    attached.removeEventListener('touchmove', onTouchMove);
    attached = null;
  }

  watch(
    target,
    el => {
      detach();
      if (!el) return;

      el.setAttribute(POINTER_DRAG_SURFACE_ATTRIBUTE, '');
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerCancel);
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      attached = el;
    },
    { immediate: true },
  );

  onUnmounted(detach);

  return { dragging };
}
