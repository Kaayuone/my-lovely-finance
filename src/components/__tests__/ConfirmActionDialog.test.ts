// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import ConfirmActionDialog from '@/components/ConfirmActionDialog.vue';
import { ButtonStub, DialogStub } from './testStubs';

// PrimeVue's Dialog keeps its content in the DOM while it plays the leave animation, and its
// buttons can still be tapped
const LeavingDialogStub = defineComponent({
  name: 'LeavingDialogTestStub',
  props: {
    visible: Boolean,
  },
  emits: ['update:visible'],
  setup(_, { slots }) {
    return () => h('section', slots.default?.());
  },
});

const useHardwareBackHandler = vi.hoisted(() =>
  vi.fn<(options: { priority: number; isActive: () => boolean; onBack: () => void }) => void>(),
);

vi.mock('@/services/hardwareBack', () => ({
  HARDWARE_BACK_PRIORITY_CONFIRM_DIALOG: 300,
  useHardwareBackHandler,
}));

function mountDialog() {
  return mount(ConfirmActionDialog, {
    props: {
      modelValue: true,
      header: 'Удалить запись',
      message: 'Действие нельзя отменить',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        Dialog: DialogStub,
      },
    },
  });
}

describe('ConfirmActionDialog', () => {
  it('renders the message and closes without confirming', async () => {
    const wrapper = mountDialog();

    expect(wrapper.get('h2').text()).toBe('Удалить запись');
    expect(wrapper.text()).toContain('Действие нельзя отменить');
    expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Отмена', 'Удалить']);

    await wrapper.findAll('button')[0]?.trigger('click');
    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  it('emits confirmation and closes from the primary action', async () => {
    const wrapper = mountDialog();

    await wrapper.findAll('button')[1]?.trigger('click');

    expect(wrapper.emitted('confirm')).toEqual([[]]);
    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
  });

  it('confirms once per opening when the button is tapped again as the dialog leaves', async () => {
    const open = ref(true);
    let confirmations = 0;
    const Host = defineComponent({
      setup: () => () =>
        h(ConfirmActionDialog, {
          modelValue: open.value,
          header: 'Удалить запись',
          message: 'Действие нельзя отменить',
          'onUpdate:modelValue': (value: boolean) => {
            open.value = value;
          },
          onConfirm: () => {
            confirmations += 1;
          },
        }),
    });
    const wrapper = mount(Host, {
      global: { stubs: { Button: ButtonStub, Dialog: LeavingDialogStub } },
    });
    const confirmButton = () => wrapper.findAll('button')[1];

    await confirmButton()?.trigger('click');
    await nextTick();

    expect(open.value).toBe(false);
    expect(confirmButton()?.text()).toBe('Удалить');

    await confirmButton()?.trigger('click');

    expect(confirmations).toBe(1);
  });

  it('registers a back handler that closes only an active dialog', async () => {
    const wrapper = mountDialog();
    const handler = useHardwareBackHandler.mock.calls.at(-1)?.[0];

    expect(handler?.priority).toBe(300);
    expect(handler?.isActive()).toBe(true);
    handler?.onBack();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });
});
