// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { usePointerDrag } from '@/composables/usePointerDrag';

const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

const requestFrame = vi.fn((callback: FrameRequestCallback) => {
  const frameId = nextFrameId;
  nextFrameId += 1;
  frames.set(frameId, callback);
  return frameId;
});
const cancelFrame = vi.fn((frameId: number) => {
  frames.delete(frameId);
});

function mountDrag(options: Parameters<typeof usePointerDrag>[1]) {
  const element = document.createElement('div');
  Object.defineProperty(element, 'setPointerCapture', { value: vi.fn() });
  const target = ref<HTMLElement | null>(element);
  let drag: ReturnType<typeof usePointerDrag> | undefined;

  const wrapper = mount(
    defineComponent({
      setup() {
        drag = usePointerDrag(target, options);
        return () => h('div');
      },
    }),
  );

  if (!drag) throw new Error('usePointerDrag did not run');
  return { drag, element, wrapper };
}

function dispatchPointer(element: HTMLElement, type: string, clientX: number, clientY = 0) {
  element.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX, clientY, pointerId: 1 }));
}

function dispatchTouchMove(element: HTMLElement) {
  const event = new Event('touchmove', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event.defaultPrevented;
}

function runAnimationFrame() {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(16);
}

enableAutoUnmount(afterEach);

describe('usePointerDrag', () => {
  beforeEach(() => {
    frames.clear();
    nextFrameId = 1;
    requestFrame.mockClear();
    cancelFrame.mockClear();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies only the latest pointer move once per animation frame', () => {
    const onDrag = vi.fn();
    const { element } = mountDrag({ isDrag: () => true, onDrag });

    dispatchPointer(element, 'pointerdown', 10, 20);
    dispatchPointer(element, 'pointermove', 14, 24);
    dispatchPointer(element, 'pointermove', 18, 30);

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(onDrag).not.toHaveBeenCalled();

    runAnimationFrame();

    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalledWith(expect.objectContaining({ dx: 8, dy: 10 }));
  });

  it('flushes the latest pending move before releasing the drag', () => {
    const calls: string[] = [];
    const onDrag = vi.fn(state => calls.push(`drag:${state.dx}`));
    const onRelease = vi.fn(state => calls.push(`release:${state.dx}`));
    const { element } = mountDrag({ isDrag: () => true, onDrag, onRelease });

    dispatchPointer(element, 'pointerdown', 10);
    dispatchPointer(element, 'pointermove', 30);
    dispatchPointer(element, 'pointerup', 35);

    expect(calls).toEqual(['drag:20', 'release:25']);
    expect(onRelease).toHaveBeenCalledWith(expect.objectContaining({ dragged: true }));
    expect(cancelFrame).toHaveBeenCalledWith(1);

    runAnimationFrame();
    expect(onDrag).toHaveBeenCalledTimes(1);
  });

  it('drops a pending move and clears the drag on pointer cancellation and unmount', () => {
    const onDrag = vi.fn();
    const onCancel = vi.fn();
    const first = mountDrag({ isDrag: () => true, onDrag, onCancel });

    dispatchPointer(first.element, 'pointerdown', 0);
    dispatchPointer(first.element, 'pointermove', 10);
    runAnimationFrame();
    dispatchPointer(first.element, 'pointermove', 20);
    dispatchPointer(first.element, 'pointercancel', 20);

    expect(first.drag.dragging.value).toBe(false);
    expect(onCancel).toHaveBeenCalledOnce();
    runAnimationFrame();
    expect(onDrag).toHaveBeenCalledOnce();

    const secondOnDrag = vi.fn();
    const second = mountDrag({ isDrag: () => true, onDrag: secondOnDrag });
    dispatchPointer(second.element, 'pointerdown', 0);
    dispatchPointer(second.element, 'pointermove', 10);
    runAnimationFrame();
    dispatchPointer(second.element, 'pointermove', 20);

    second.wrapper.unmount();
    expect(second.drag.dragging.value).toBe(false);
    runAnimationFrame();
    expect(secondOnDrag).toHaveBeenCalledOnce();
  });

  it('leaves a press inside a nested surface to that surface', () => {
    const outerDrag = vi.fn();
    const innerDrag = vi.fn();
    const { element: outer } = mountDrag({ isDrag: () => true, onDrag: outerDrag });
    const { element: inner } = mountDrag({ isDrag: () => true, onDrag: innerDrag });
    outer.appendChild(inner);

    dispatchPointer(inner, 'pointerdown', 0);
    dispatchPointer(inner, 'pointermove', 10);
    runAnimationFrame();

    expect(innerDrag).toHaveBeenCalledOnce();
    expect(outerDrag).not.toHaveBeenCalled();

    dispatchPointer(inner, 'pointerup', 10);
    dispatchPointer(outer, 'pointerdown', 0);
    dispatchPointer(outer, 'pointermove', 10);
    runAnimationFrame();

    expect(outerDrag).toHaveBeenCalledOnce();
  });

  // Under `touch-action` the browser drops the scroll of a drag but still flings it on release, and
  // that invisible fling swallows the next tap wherever it lands
  it('cancels the touch moves of a drag and leaves the others to the browser', () => {
    const { element } = mountDrag({ isDrag: ({ dx }) => Math.abs(dx) >= 6 });

    expect(dispatchTouchMove(element)).toBe(false);

    dispatchPointer(element, 'pointerdown', 0);
    dispatchPointer(element, 'pointermove', 3);
    expect(dispatchTouchMove(element)).toBe(false);

    // The move that makes the drag counts before its animation frame has run
    dispatchPointer(element, 'pointermove', 10);
    expect(dispatchTouchMove(element)).toBe(true);

    runAnimationFrame();
    expect(dispatchTouchMove(element)).toBe(true);

    dispatchPointer(element, 'pointerup', 10);
    expect(dispatchTouchMove(element)).toBe(false);
  });
});
