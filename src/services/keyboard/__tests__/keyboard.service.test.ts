// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

import type { MockInstance } from 'vitest';
import type { PluginListenerHandle } from '@capacitor/core';
import type { KeyboardInfo } from '@capacitor/keyboard';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: { addListener: vi.fn() },
}));

const KEYBOARD_EVENTS = [
  'keyboardWillShow',
  'keyboardDidShow',
  'keyboardWillHide',
  'keyboardDidHide',
];

function createHandle(): PluginListenerHandle & { remove: ReturnType<typeof vi.fn> } {
  return { remove: vi.fn().mockResolvedValue(undefined) };
}

async function importService() {
  return import('@/services/keyboard/keyboard.service');
}

describe('keyboard listener registration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('registers every keyboard event and removes them all on cleanup', async () => {
    const handles = KEYBOARD_EVENTS.map(() => createHandle());
    for (const handle of handles) vi.mocked(Keyboard.addListener).mockResolvedValueOnce(handle);
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');

    const { registerKeyboardListeners } = await importService();
    const remove = await registerKeyboardListeners();

    expect(vi.mocked(Keyboard.addListener).mock.calls.map(([event]) => event)).toEqual(
      KEYBOARD_EVENTS,
    );

    remove();

    for (const handle of handles) expect(handle.remove).toHaveBeenCalledTimes(1);
    expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('removes the already registered listeners when a later registration rejects', async () => {
    const willShow = createHandle();
    const didShow = createHandle();
    vi.mocked(Keyboard.addListener)
      .mockResolvedValueOnce(willShow)
      .mockResolvedValueOnce(didShow)
      .mockRejectedValueOnce(new Error('listener registration failed'));
    const addWindowListener = vi.spyOn(window, 'addEventListener');

    const { registerKeyboardListeners } = await importService();

    await expect(registerKeyboardListeners()).rejects.toThrow('listener registration failed');

    expect(willShow.remove).toHaveBeenCalledTimes(1);
    expect(didShow.remove).toHaveBeenCalledTimes(1);
    expect(addWindowListener).not.toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('leaves the keyboard state untouched when a registration rejects', async () => {
    vi.mocked(Keyboard.addListener)
      .mockResolvedValueOnce(createHandle())
      .mockRejectedValueOnce(new Error('listener registration failed'));

    const { isKeyboardOpen, registerKeyboardListeners } = await importService();
    await expect(registerKeyboardListeners()).rejects.toThrow();

    expect(isKeyboardOpen.value).toBe(false);
  });

  it('falls back to the visual viewport on web and detaches it on cleanup', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const viewport = {
      height: 800,
      scale: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('visualViewport', viewport);

    const { registerKeyboardListeners } = await importService();
    const remove = await registerKeyboardListeners();

    expect(viewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(Keyboard.addListener).not.toHaveBeenCalled();

    remove();

    expect(viewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

describe('keyboard height and visibility', () => {
  let remove: (() => void) | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.stubGlobal('innerWidth', 360);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('visualViewport', undefined);
    document.documentElement.style.removeProperty('--keyboard-height');
  });

  afterEach(() => {
    remove?.();
    remove = undefined;
    vi.unstubAllGlobals();
  });

  it.each([
    { resizedHeight: 800, overlap: '300px' },
    { resizedHeight: 650, overlap: '150px' },
    { resizedHeight: 500, overlap: '0px' },
  ])(
    'writes only the overlap left after resizing to $resizedHeight',
    async ({ resizedHeight, overlap }) => {
      const listeners = new Map<string, (info: KeyboardInfo) => void>();
      vi.mocked(Keyboard.addListener).mockImplementation(
        async (eventName: string, listener: (info: KeyboardInfo) => void) => {
          listeners.set(eventName, listener);
          return createHandle();
        },
      );
      const { isKeyboardOpen, registerKeyboardListeners } = await importService();
      remove = await registerKeyboardListeners();
      expect(isKeyboardOpen.value).toBe(false);

      listeners.get('keyboardWillShow')?.({ keyboardHeight: 300 });
      expect(isKeyboardOpen.value).toBe(true);
      vi.stubGlobal('innerHeight', resizedHeight);
      window.dispatchEvent(new Event('resize'));
      listeners.get('keyboardDidShow')?.({ keyboardHeight: 300 });

      expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe(overlap);
      expect(isKeyboardOpen.value).toBe(true);

      listeners.get('keyboardWillHide')?.({ keyboardHeight: 0 });
      expect(isKeyboardOpen.value).toBe(false);
      expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('0px');

      listeners.get('keyboardDidShow')?.({ keyboardHeight: 300 });
      remove();
      remove = undefined;
      expect(isKeyboardOpen.value).toBe(false);
      expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('0px');
    },
  );

  it('tracks visual viewport overlap on web and ignores pinch zoom', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const viewport = Object.assign(new EventTarget(), { height: 500, scale: 1 });
    vi.stubGlobal('visualViewport', viewport);
    const { isKeyboardOpen, registerKeyboardListeners } = await importService();
    remove = await registerKeyboardListeners();

    viewport.dispatchEvent(new Event('resize'));
    expect(isKeyboardOpen.value).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('300px');

    viewport.height = 400;
    viewport.scale = 2;
    viewport.dispatchEvent(new Event('resize'));
    expect(isKeyboardOpen.value).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('0px');

    viewport.height = 250;
    viewport.dispatchEvent(new Event('resize'));
    remove();
    remove = undefined;
    expect(isKeyboardOpen.value).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('0px');
  });
});

describe('scrolling the focused field once the keyboard is up', () => {
  // The markup of InputNumberField: the message closes the root, right after the FloatLabel
  const numberField = (id: string, message?: string) => `
    <div id="${id}_root" class="w-full">
      <span class="p-floatlabel p-floatlabel-on">
        <span class="p-inputnumber"><input id="${id}" class="p-inputtext" /></span>
        <label for="${id}">${id}</label>
        <button type="button" aria-label="Очистить"></button>
      </span>
      ${message ? `<small data-field-error>${message}</small>` : ''}
    </div>
  `;

  let scrollIntoView: MockInstance<Element['scrollIntoView']>;
  let remove: (() => void) | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  });

  afterEach(() => {
    remove?.();
    remove = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  async function showKeyboardOver(focusedId: string) {
    const listeners = new Map<string, (info: KeyboardInfo) => void>();
    vi.mocked(Keyboard.addListener).mockImplementation(
      async (eventName: string, listener: (info: KeyboardInfo) => void) => {
        listeners.set(eventName, listener);
        return createHandle();
      },
    );

    const { registerKeyboardListeners } = await importService();
    remove = await registerKeyboardListeners();

    document.getElementById(focusedId)?.focus();
    listeners.get('keyboardDidShow')?.({ keyboardHeight: 300 });
  }

  function expectScrolledOnly(id: string) {
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById(id));
  }

  it('brings the message along with the field it belongs to', async () => {
    document.body.innerHTML = `
      <div class="flex">
        ${numberField('week')}
        ${numberField('year', 'Укажите неделю и год изготовления')}
      </div>
    `;

    await showKeyboardOver('year');

    expectScrolledOnly('year_root');
  });

  it('lines up the field itself when it has no message', async () => {
    document.body.innerHTML = numberField('year');

    await showKeyboardOver('year');

    expectScrolledOnly('year');
  });

  it('leaves the message of a neighbour in the same row to that neighbour', async () => {
    document.body.innerHTML = `
      <div class="flex">
        ${numberField('week')}
        ${numberField('year', 'Укажите неделю и год изготовления')}
      </div>
    `;

    await showKeyboardOver('week');

    expectScrolledOnly('week');
  });

  it('does not take the message of the whole form for a message of the field', async () => {
    document.body.innerHTML = `
      <div class="flex flex-wrap">
        ${numberField('title')}
        <small data-field-error>Заполните хотя бы один интервал повтора</small>
        ${numberField('interval_days')}
      </div>
    `;

    await showKeyboardOver('title');

    expectScrolledOnly('title');
  });

  // A compound input renders its message outside the field, under the −/field/+ row and
  // above its own step SelectButton
  it('brings the whole compound input along with its message', async () => {
    document.body.innerHTML = `
      <div id="quantity_input" class="w-full">
        <div class="flex">
          <button type="button" aria-label="Уменьшить"></button>
          ${numberField('quantity')}
          <button type="button" aria-label="Увеличить"></button>
        </div>
        <small data-field-error>Укажите значение</small>
        <div class="p-selectbutton"><button type="button">10</button></div>
      </div>
      ${numberField('amount')}
    `;

    await showKeyboardOver('quantity');

    expectScrolledOnly('quantity_input');
  });

  it('does not count a switch in the field root as another field', async () => {
    document.body.innerHTML = `
      <div id="price_field" class="w-full">
        ${numberField('price')}
        <input id="unknown" type="checkbox" role="switch" />
        <small data-field-error>Укажите значение</small>
      </div>
      ${numberField('amount')}
    `;

    await showKeyboardOver('price');

    expectScrolledOnly('price_field');
  });

  // A Select without `editable` renders no input, so only its class tells it apart
  const currencySelect = `
    <span class="p-floatlabel p-floatlabel-on">
      <div class="p-select p-invalid"><span role="combobox">BYN</span></div>
      <label>Валюта*</label>
    </span>
    <small data-field-error>Выберите значение</small>
  `;

  it.each([
    ['wrapped together with its message', `<div>${currencySelect}</div>`],
    ['followed by its message', currencySelect],
  ])('leaves the message of a neighbouring Select %s to that Select', async (_, select) => {
    document.body.innerHTML = `
      <div class="flex">
        ${numberField('amount')}
        ${select}
      </div>
    `;

    await showKeyboardOver('amount');

    expectScrolledOnly('amount');
  });

  // The message right after the row reads as the amount's own, so only the Select in the row keeps
  // the climb from taking the whole form for the amount's root
  it('stops before the message of the whole form behind a row with a Select', async () => {
    document.body.innerHTML = `
      <div id="form">
        <div class="flex">
          ${numberField('amount')}
          <div class="p-select"><span role="combobox">BYN</span></div>
        </div>
        <small data-field-error>Заполните хотя бы одно поле</small>
      </div>
    `;

    await showKeyboardOver('amount');

    expectScrolledOnly('amount');
  });

  it('lines up the field itself when its root is taller than the screen', async () => {
    vi.stubGlobal('visualViewport', { height: 400 });
    document.body.innerHTML = numberField('year', 'Укажите неделю и год изготовления');
    const tallRect = new DOMRect(0, 0, 360, 401);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(tallRect);

    await showKeyboardOver('year');

    expectScrolledOnly('year');
  });
});
