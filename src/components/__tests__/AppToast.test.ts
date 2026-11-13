// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { ru } from 'primelocale/js/ru.js';
import AppToast from '@/components/AppToast.vue';
import { SWIPE_COMMIT_SHIFT_PX } from '@/constants/gestures';

const animate = vi.fn<(keyframes: Keyframe[], options: KeyframeAnimationOptions) => Animation>();
Element.prototype.animate = animate;

// The real Toast and ToastService: the message, its close button and the root the swipe listens
// on are PrimeVue's own markup
async function showToast() {
  const wrapper = mount(AppToast, {
    global: { plugins: [[PrimeVue, { locale: ru }], ToastService] },
  });
  await flushPromises();
  wrapper.vm.$toast.add({ severity: 'success', summary: 'Сохранено', detail: 'Запись добавлена' });
  await flushPromises();
  return wrapper;
}

function message() {
  return document.querySelector<HTMLElement>('.p-toast-message');
}

function messageText() {
  const text = document.querySelector<HTMLElement>('.p-toast-detail');
  if (!text) throw new Error('No toast on screen');
  return text;
}

function dispatchPointer(element: HTMLElement, type: string, clientX: number, clientY = 0) {
  element.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX, clientY, pointerId: 1 }));
}

async function swipe(element: HTMLElement, dx: number, dy = 0) {
  dispatchPointer(element, 'pointerdown', 100, 100);
  dispatchPointer(element, 'pointermove', 100 + dx, 100 + dy);
  await new Promise(resolve => requestAnimationFrame(resolve));
}

enableAutoUnmount(afterEach);

describe('AppToast', () => {
  beforeEach(() => {
    animate.mockClear();
    vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('closes a message on a tap on its body', async () => {
    await showToast();
    const text = messageText();

    dispatchPointer(text, 'pointerdown', 100);
    dispatchPointer(text, 'pointerup', 100);
    text.click();
    await flushPromises();

    expect(message()).toBeNull();
  });

  it('keeps the close button under its name, and it still closes the message', async () => {
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    await showToast();

    const closeButton = document.querySelector<HTMLElement>('button[aria-label="Закрыть"]');
    expect(closeButton).not.toBeNull();
    closeButton?.click();
    await flushPromises();

    expect(message()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('moves a message with the finger and closes it once swiped past the threshold', async () => {
    await showToast();
    const text = messageText();

    await swipe(text, -(SWIPE_COMMIT_SHIFT_PX + 10));
    expect(message()?.style.getPropertyValue('translate')).toBe(
      `${-(SWIPE_COMMIT_SHIFT_PX + 10)}px`,
    );
    dispatchPointer(text, 'pointerup', 100 - (SWIPE_COMMIT_SHIFT_PX + 10));
    await flushPromises();

    expect(message()).toBeNull();
  });

  it('puts a message swiped short of the threshold back, and the click after it does not close it', async () => {
    await showToast();
    const text = messageText();

    await swipe(text, SWIPE_COMMIT_SHIFT_PX - 20);
    dispatchPointer(text, 'pointerup', 100 + SWIPE_COMMIT_SHIFT_PX - 20);
    text.click();
    await flushPromises();

    expect(message()).not.toBeNull();
    expect(message()?.style.getPropertyValue('translate')).toBe('');
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]?.[0][0]).toEqual({
      translate: `${SWIPE_COMMIT_SHIFT_PX - 20}px`,
    });
  });

  it('leaves a vertical move alone', async () => {
    await showToast();
    const text = messageText();

    await swipe(text, 10, 60);
    expect(message()?.style.getPropertyValue('translate')).toBe('');
    dispatchPointer(text, 'pointerup', 110, 160);
    await flushPromises();

    expect(message()).not.toBeNull();
  });
});
