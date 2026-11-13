// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import InputTime from '@/components/InputTime.vue';
import { ButtonStub, DialogStub, FloatLabelStub, InputTextStub } from './testStubs';

const useHardwareBackHandler = vi.hoisted(() =>
  vi.fn<(options: { priority: number; isActive: () => boolean; onBack: () => void }) => void>(),
);

vi.mock('@/services/hardwareBack', () => ({
  HARDWARE_BACK_PRIORITY_DRAWER_DIALOG: 20,
  useHardwareBackHandler,
}));

// Every tap moves the wheel one step forward, enough to tell the two wheels apart
const WheelPickerStub = defineComponent({
  name: 'WheelPicker',
  props: {
    modelValue: { type: Number, required: true },
    options: { type: Array, required: true },
    label: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          'aria-label': props.label,
          onClick: () => emit('update:modelValue', props.modelValue + 1),
        },
        String(props.modelValue),
      );
  },
});

function mountInput(props: {
  modelValue: { hours: number; minutes: number } | null;
  hoursOnly?: boolean;
}) {
  return mount(InputTime, {
    props: { id: 'record_time', label: 'Время', ...props },
    global: {
      stubs: {
        Button: ButtonStub,
        Dialog: DialogStub,
        FloatLabel: FloatLabelStub,
        InputText: InputTextStub,
        WheelPicker: WheelPickerStub,
      },
    },
  });
}

// ButtonStub renders the label as text, not as an accessible name
function getButton(wrapper: ReturnType<typeof mountInput>, label: string) {
  const button = wrapper.findAll('button').find(candidate => candidate.text() === label);
  if (!button) throw new Error(`Button "${label}" is not rendered`);
  return button;
}

describe('InputTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 14, 37));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the value and applies the time picked on both wheels', async () => {
    const wrapper = mountInput({ modelValue: { hours: 9, minutes: 5 } });

    expect(wrapper.get('input').element.value).toBe('09:05');
    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false);

    await wrapper.get('input').trigger('click');
    expect(wrapper.get('[data-testid="dialog"] h2').text()).toBe('Время');

    await wrapper.get('button[aria-label="Часы"]').trigger('click');
    await wrapper.get('button[aria-label="Часы"]').trigger('click');
    await wrapper.get('button[aria-label="Минуты"]').trigger('click');
    await getButton(wrapper, 'Готово').trigger('click');

    expect(wrapper.emitted('update:model-value')).toEqual([[{ hours: 11, minutes: 6 }]]);
    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false);
  });

  it('pins the minutes to zero when only the hour is picked', async () => {
    const wrapper = mountInput({ modelValue: { hours: 10, minutes: 0 }, hoursOnly: true });

    await wrapper.get('input').trigger('click');

    expect(wrapper.find('button[aria-label="Минуты"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="dialog"]').text()).toContain('00');

    await wrapper.get('button[aria-label="Часы"]').trigger('click');
    await getButton(wrapper, 'Готово').trigger('click');

    expect(wrapper.emitted('update:model-value')).toEqual([[{ hours: 11, minutes: 0 }]]);
  });

  it('starts an empty field at the current time and cancels without emitting', async () => {
    const wrapper = mountInput({ modelValue: null });

    expect(wrapper.get('input').element.value).toBe('');

    await wrapper.get('input').trigger('click');
    expect(wrapper.get('button[aria-label="Часы"]').text()).toBe('14');
    expect(wrapper.get('button[aria-label="Минуты"]').text()).toBe('37');

    await getButton(wrapper, 'Отмена').trigger('click');

    expect(wrapper.emitted('update:model-value')).toBeUndefined();
    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false);
  });

  it('registers a back handler that closes only an open picker', async () => {
    const wrapper = mountInput({ modelValue: { hours: 9, minutes: 5 } });
    const handler = useHardwareBackHandler.mock.calls.at(-1)?.[0];

    expect(handler?.priority).toBe(20);
    expect(handler?.isActive()).toBe(false);

    await wrapper.get('input').trigger('click');
    expect(handler?.isActive()).toBe(true);

    handler?.onBack();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false);
  });
});
