// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { h } from 'vue';
import CurrencySelect from '@/components/CurrencySelect.vue';
import FormDrawer from '@/components/FormDrawer.vue';
import InputDateTime from '@/components/InputDateTime.vue';
import { dispatchHardwareBack, registerHardwareBackListener } from '@/services/hardwareBack';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) }),
    exitApp: vi.fn(),
  },
}));

let removeListener: Awaited<ReturnType<typeof registerHardwareBackListener>>;

// A form like the operation one: a currency list and a calendar inside the sheet. The drawer, the
// select and the date picker are the real PrimeVue ones, transitions included, so an Escape that
// slipped past the overlay would reach the drawer's own Escape listener on the document.
function mountForm() {
  return mount(FormDrawer, {
    props: { modelValue: true, header: 'Новая операция' },
    slots: {
      default: () => [
        h(CurrencySelect, { id: 'currency', modelValue: 'BYN' }),
        h(InputDateTime, { id: 'date', modelValue: new Date(2026, 9, 14, 9, 30) }),
      ],
    },
    global: {
      plugins: [PrimeVue],
      stubs: { transition: false },
    },
  });
}

async function mountOpenForm() {
  const wrapper = mountForm();
  await vi.waitFor(() => expect(document.querySelector('.p-select')).not.toBeNull());
  return wrapper;
}

function isDrawerOpen() {
  return document.querySelector('.p-drawer') !== null;
}

enableAutoUnmount(afterEach);

describe('FormDrawer with an open overlay on hardware back', () => {
  beforeEach(async () => {
    removeListener = await registerHardwareBackListener({
      currentRoute: { value: { name: 'operations' } },
      replace: vi.fn(),
    } as never);
  });

  afterEach(async () => {
    await removeListener();
  });

  it('closes the currency list first and the sheet on the next press', async () => {
    const wrapper = await mountOpenForm();

    document.querySelector<HTMLElement>('.p-select')?.click();
    await flushPromises();
    expect(document.querySelector('.p-select-overlay')).not.toBeNull();

    expect(dispatchHardwareBack()).toBe(true);
    await vi.waitFor(() => expect(document.querySelector('.p-select-overlay')).toBeNull());

    expect(isDrawerOpen()).toBe(true);
    expect(wrapper.emitted('update:model-value')).toBeUndefined();

    expect(dispatchHardwareBack()).toBe(true);
    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
  });

  it('closes the calendar first and leaves no keyboard raised by its input', async () => {
    const wrapper = await mountOpenForm();
    const input = document.querySelector<HTMLInputElement>('.p-datepicker input');

    input?.focus();
    await flushPromises();
    expect(document.querySelector('.p-datepicker-panel')).not.toBeNull();

    expect(dispatchHardwareBack()).toBe(true);
    await vi.waitFor(() => expect(document.querySelector('.p-datepicker-panel')).toBeNull());

    expect(document.activeElement).not.toBe(input);
    expect(isDrawerOpen()).toBe(true);
    expect(wrapper.emitted('update:model-value')).toBeUndefined();

    expect(dispatchHardwareBack()).toBe(true);
    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
  });
});
