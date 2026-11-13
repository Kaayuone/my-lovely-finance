// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { defineComponent, h, nextTick } from 'vue';
import FormDrawer from '@/components/FormDrawer.vue';
import { ButtonStub, DrawerStub } from './testStubs';
import type { Component } from 'vue';

const useHardwareBackHandler = vi.hoisted(() =>
  vi.fn<(options: { priority: number; isActive: () => boolean; onBack: () => void }) => void>(),
);

vi.mock('@/services/hardwareBack', () => ({
  HARDWARE_BACK_PRIORITY_FORM_DRAWER: 200,
  useHardwareBackHandler,
}));

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

// PrimeVue's Drawer keeps its container mounted until the leave animation ends, so the buttons
// outlive `visible`; the shared DrawerStub unmounts them at once and cannot show that window.
const LeavingDrawerStub = defineComponent({
  name: 'LeavingDrawerTestStub',
  props: { visible: Boolean },
  emits: ['update:visible'],
  setup(_, { slots }) {
    return () => h('section', slots.container?.({ closeCallback: () => undefined }));
  },
});

function mountDrawer(showDelete = false, readonly = false, drawer: Component = DrawerStub) {
  return mount(FormDrawer, {
    props: {
      modelValue: true,
      header: 'Добавить запись',
      showDelete,
      readonly,
    },
    slots: {
      default: '<div data-testid="content">Form content</div>',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        Drawer: drawer,
      },
    },
  });
}

function runAnimationFrame() {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(16);
}

// The form is held back until the browser has painted the sheet at its start position
async function runContentFrames() {
  runAnimationFrame();
  runAnimationFrame();
  await nextTick();
}

enableAutoUnmount(afterEach);

describe('FormDrawer', () => {
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

  it('renders its header and content and emits save', async () => {
    const wrapper = mountDrawer();
    await runContentFrames();

    expect(wrapper.get('h2').text()).toBe('Добавить запись');
    expect(wrapper.get('[data-testid="content"]').text()).toBe('Form content');
    expect(wrapper.findAll('button')).toHaveLength(2);

    await wrapper.findAll('button')[1]?.trigger('click');
    expect(wrapper.emitted('save')).toEqual([[]]);
  });

  it('keeps the form out of the frame the sheet slides in on', async () => {
    const wrapper = mountDrawer();

    expect(wrapper.get('h2').text()).toBe('Добавить запись');
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);

    runAnimationFrame();
    await nextTick();

    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);

    runAnimationFrame();
    await nextTick();

    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
  });

  it('holds the form back again on the next opening', async () => {
    const wrapper = mountDrawer();
    await runContentFrames();

    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });

    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);

    await runContentFrames();

    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
  });

  it('shows an optional delete action and delegates the close callback', async () => {
    const wrapper = mountDrawer(true);
    const buttons = wrapper.findAll('button');

    expect(buttons).toHaveLength(3);
    await buttons[1]?.trigger('click');
    expect(wrapper.emitted('delete')).toEqual([[]]);

    await buttons[0]?.trigger('click');
    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
  });

  describe('delete button name', () => {
    it('is "Удалить" unless the caller says otherwise', () => {
      const wrapper = mountDrawer(true);

      expect(wrapper.find('[aria-label="Удалить"]').exists()).toBe(true);
    });

    it('is the name the caller gives the action behind its icon', async () => {
      const wrapper = mountDrawer(true);
      await wrapper.setProps({ deleteLabel: 'Архивировать' });

      expect(wrapper.find('[aria-label="Удалить"]').exists()).toBe(false);

      await wrapper.get('[aria-label="Архивировать"]').trigger('click');
      expect(wrapper.emitted('delete')).toEqual([[]]);
    });
  });

  // `#container` replaces the markup that would carry the title, so PrimeVue gives the dialog no name
  it('names the dialog after its header', async () => {
    mount(FormDrawer, {
      props: { modelValue: true, header: 'Изменить счёт' },
      global: { plugins: [PrimeVue], stubs: { transition: false } },
    });
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Изменить счёт',
    );
  });

  it('offers nothing to save on a read-only form and leaves the delete action to the caller', async () => {
    const wrapper = mountDrawer(true, true);
    await runContentFrames();

    expect(wrapper.find('[aria-label="Сохранить"]').exists()).toBe(false);
    expect(wrapper.get('[aria-label="Только просмотр"]').attributes('role')).toBe('img');
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);

    await wrapper.get('[aria-label="Удалить"]').trigger('click');
    expect(wrapper.emitted('delete')).toEqual([[]]);
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  it('registers a hardware back handler for the visible drawer', async () => {
    const wrapper = mountDrawer();
    const handler = useHardwareBackHandler.mock.calls.at(-1)?.[0];

    expect(handler?.priority).toBe(200);
    expect(handler?.isActive()).toBe(true);
    handler?.onBack();
    await nextTick();

    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
  });

  describe('while closing', () => {
    it('drops a save or delete tap that lands in the leave animation', async () => {
      const wrapper = mountDrawer(true, false, LeavingDrawerStub);
      await wrapper.setProps({ modelValue: false });

      await wrapper.get('[aria-label="Сохранить"]').trigger('click');
      await wrapper.get('[aria-label="Удалить"]').trigger('click');

      expect(wrapper.emitted('save')).toBeUndefined();
      expect(wrapper.emitted('delete')).toBeUndefined();
    });

    it('still takes both while the form is open', async () => {
      const wrapper = mountDrawer(true, false, LeavingDrawerStub);

      await wrapper.get('[aria-label="Сохранить"]').trigger('click');
      await wrapper.get('[aria-label="Удалить"]').trigger('click');

      expect(wrapper.emitted('save')).toEqual([[]]);
      expect(wrapper.emitted('delete')).toEqual([[]]);
    });
  });

  describe('while saving', () => {
    it('turns the save and delete actions off and drops a click that gets through', async () => {
      const wrapper = mountDrawer(true);
      await runContentFrames();
      await wrapper.setProps({ saving: true });

      expect(wrapper.get('[aria-label="Сохранить"]').attributes('disabled')).toBeDefined();
      expect(wrapper.get('[aria-label="Удалить"]').attributes('disabled')).toBeDefined();

      // A tap that lands before the button re-renders still reaches the handler
      const [, deleteButton, saveButton] = wrapper.findAllComponents(ButtonStub);
      deleteButton?.vm.$emit('click');
      saveButton?.vm.$emit('click');
      await nextTick();

      expect(wrapper.emitted('save')).toBeUndefined();
      expect(wrapper.emitted('delete')).toBeUndefined();
    });

    it('is closed only by the caller, not by the close button, Escape or hardware back', async () => {
      const wrapper = mountDrawer();
      await wrapper.setProps({ saving: true });
      const handler = useHardwareBackHandler.mock.calls.at(-1)?.[0];

      expect(wrapper.get('[aria-label="Закрыть"]').attributes('disabled')).toBeDefined();
      expect(wrapper.findComponent(DrawerStub).attributes('close-on-escape')).toBe('false');

      // Still active, so the back press is taken here instead of reaching the page under the form
      expect(handler?.isActive()).toBe(true);
      handler?.onBack();
      await nextTick();

      expect(wrapper.emitted('update:model-value')).toBeUndefined();

      await wrapper.setProps({ modelValue: false });

      expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false);
    });

    it('takes commands again once the save is over', async () => {
      const wrapper = mountDrawer(true);
      await wrapper.setProps({ saving: true });
      await wrapper.setProps({ saving: false });

      expect(wrapper.findComponent(DrawerStub).attributes('close-on-escape')).toBe('true');

      await wrapper.get('[aria-label="Сохранить"]').trigger('click');
      await wrapper.get('[aria-label="Удалить"]').trigger('click');
      await wrapper.get('[aria-label="Закрыть"]').trigger('click');

      expect(wrapper.emitted('save')).toEqual([[]]);
      expect(wrapper.emitted('delete')).toEqual([[]]);
      expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
    });
  });
});
