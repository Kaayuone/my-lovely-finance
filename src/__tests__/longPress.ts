import { vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

import { LONG_PRESS_DELAY_MS, LONG_PRESS_RELEASE_GUARD_MS } from '@/constants/gestures';

/** A primary touch pointer event at (100, 100), bubbling and cancelable, as the gesture reads it */
export function dispatchPointer(
  target: Element,
  type: string,
  init: PointerEventInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'touch',
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/**
 * The finger stays down for the whole delay and lifts; the wait after it lets the guard that keeps
 * the lift from tapping the page run out, as a person's next tap does. Needs fake timers.
 */
export async function holdElement(target: Element): Promise<void> {
  dispatchPointer(target, 'pointerdown');
  vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);
  dispatchPointer(target, 'pointerup');
  vi.advanceTimersByTime(LONG_PRESS_RELEASE_GUARD_MS);
  await flushPromises();
}
