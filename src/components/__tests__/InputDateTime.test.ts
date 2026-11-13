// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import InputDateTime from '@/components/InputDateTime.vue';
import { FloatLabelStub } from './testStubs';

const PICKED_DAY = new Date(2026, 8, 20);
const PICKED_TIME = { hours: 8, minutes: 30 };

// The calendar hands back a day at midnight, or nothing when the field is cleared
const DatePickerStub = defineComponent({
  name: 'DatePicker',
  props: { modelValue: Date, invalid: Boolean },
  emits: ['update:modelValue'],
  setup(_, { emit }) {
    return () => [
      h('button', {
        type: 'button',
        'aria-label': 'Выбрать день',
        onClick: () => emit('update:modelValue', PICKED_DAY),
      }),
      h('button', {
        type: 'button',
        'aria-label': 'Очистить день',
        onClick: () => emit('update:modelValue', null),
      }),
    ];
  },
});

const InputTimeStub = defineComponent({
  name: 'InputTime',
  props: { modelValue: Object, id: String, label: String },
  emits: ['update:model-value'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          'aria-label': 'Выбрать время',
          onClick: () => emit('update:model-value', PICKED_TIME),
        },
        props.modelValue ? `${props.modelValue.hours}:${props.modelValue.minutes}` : '',
      );
  },
});

function mountInput(
  modelValue: Date | null,
  props: { error?: string; warning?: string; required?: boolean } = {},
) {
  // The parent applies every emitted value, as v-model does
  const wrapper = mount(InputDateTime, {
    props: {
      id: 'record_date',
      modelValue,
      'onUpdate:modelValue': (value: Date | null | undefined) => {
        void wrapper.setProps({ modelValue: value });
      },
      ...props,
    },
    global: {
      stubs: {
        DatePicker: DatePickerStub,
        FloatLabel: FloatLabelStub,
        InputTime: InputTimeStub,
      },
    },
  });
  return wrapper;
}

describe('InputDateTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 14, 37));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the time of day when the calendar picks another day', async () => {
    const wrapper = mountInput(new Date(2026, 8, 13, 9, 45, 30));

    expect(wrapper.get('button[aria-label="Выбрать время"]').text()).toBe('9:45');

    await wrapper.get('button[aria-label="Выбрать день"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[new Date(2026, 8, 20, 9, 45, 30)]]);
  });

  it('puts the picked time onto the current date with zero seconds and milliseconds', async () => {
    const wrapper = mountInput(new Date(2026, 8, 13, 9, 45, 30, 123));

    await wrapper.get('button[aria-label="Выбрать время"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[new Date(2026, 8, 13, 8, 30, 0, 0)]]);
  });

  it('puts the picked time onto today with zero seconds and milliseconds when there is no date yet', async () => {
    vi.setSystemTime(new Date(2026, 8, 13, 14, 37, 52, 410));
    const wrapper = mountInput(null);

    expect(wrapper.get('button[aria-label="Выбрать время"]').text()).toBe('');

    await wrapper.get('button[aria-label="Выбрать время"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[new Date(2026, 8, 13, 8, 30, 0, 0)]]);
  });

  it('clears the value when the calendar is emptied', async () => {
    const wrapper = mountInput(new Date(2026, 8, 13, 9, 45, 30));

    await wrapper.get('button[aria-label="Очистить день"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
  });

  // An empty optional date saves as "now" or an open period, so its time field shows nothing
  // after the erase; a required one keeps showing the erased time. The day picked next gets it either way
  describe.each([
    { name: 'required', required: true, shownTime: '14:35', shownSecondTime: '7:15' },
    { name: 'optional', required: false, shownTime: '', shownSecondTime: '' },
  ])('when a $name date is erased', ({ required, shownTime, shownSecondTime }) => {
    const SECOND_DATE = new Date(2026, 5, 1, 7, 15, 40);

    async function eraseDate(wrapper: ReturnType<typeof mountInput>) {
      await wrapper.get('button[aria-label="Очистить день"]').trigger('click');
    }

    async function pickDay(wrapper: ReturnType<typeof mountInput>) {
      await wrapper.get('button[aria-label="Выбрать день"]').trigger('click');
    }

    it('shows the time its own way and gives the erased time to the day picked next', async () => {
      const wrapper = mountInput(new Date(2026, 4, 12, 14, 35, 20), { required });

      await eraseDate(wrapper);

      expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
      expect(wrapper.get('button[aria-label="Выбрать время"]').text()).toBe(shownTime);

      await pickDay(wrapper);

      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
        new Date(2026, 8, 20, 14, 35, 20),
      ]);
    });

    it('picks a day at midnight when there was no value before', async () => {
      const wrapper = mountInput(null, { required });

      await pickDay(wrapper);

      expect(wrapper.emitted('update:modelValue')).toEqual([[PICKED_DAY]]);
    });

    it('gives a time picked after the erase to the day picked next', async () => {
      const wrapper = mountInput(new Date(2026, 4, 12, 14, 35, 20), { required });

      await eraseDate(wrapper);
      await wrapper.get('button[aria-label="Выбрать время"]').trigger('click');
      await pickDay(wrapper);

      expect(wrapper.emitted('update:modelValue')).toEqual([
        [null],
        [new Date(2026, 8, 13, 8, 30)],
        [new Date(2026, 8, 20, 8, 30)],
      ]);
    });

    it('takes the time of a date that arrives from outside for the next erase', async () => {
      const wrapper = mountInput(new Date(2026, 4, 12, 14, 35, 20), { required });

      await eraseDate(wrapper);
      await wrapper.setProps({ modelValue: SECOND_DATE });
      await eraseDate(wrapper);

      expect(wrapper.get('button[aria-label="Выбрать время"]').text()).toBe(shownSecondTime);

      await pickDay(wrapper);

      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
        new Date(2026, 8, 20, 7, 15, 40),
      ]);
    });

    it('forgets the time once a date has arrived from outside and gone again', async () => {
      const wrapper = mountInput(new Date(2026, 4, 12, 14, 35, 20), { required });

      await eraseDate(wrapper);
      await wrapper.setProps({ modelValue: SECOND_DATE });
      await wrapper.setProps({ modelValue: null });

      expect(wrapper.get('button[aria-label="Выбрать время"]').text()).toBe('');

      await pickDay(wrapper);

      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([PICKED_DAY]);
    });
  });

  it('reads required when it renders, so a change of the prop switches what the empty time shows', async () => {
    const wrapper = mountInput(new Date(2026, 4, 12, 14, 35, 20));
    const timeButton = () => wrapper.get('button[aria-label="Выбрать время"]');

    await wrapper.get('button[aria-label="Очистить день"]').trigger('click');
    expect(timeButton().text()).toBe('');

    await wrapper.setProps({ required: true });
    expect(timeButton().text()).toBe('14:35');

    await wrapper.setProps({ required: false });
    expect(timeButton().text()).toBe('');
  });

  // A record stored with an empty date opens as an Invalid Date, whose NaN time must not stick
  it('shows an Invalid Date as empty and replaces it with the picked day', async () => {
    const wrapper = mountInput(new Date(NaN));

    expect(wrapper.getComponent(DatePickerStub).props('modelValue')).toBeNull();
    expect(wrapper.get('button[aria-label="Выбрать время"]').text()).toBe('');

    await wrapper.get('button[aria-label="Выбрать день"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[PICKED_DAY]]);
  });

  it('marks the date invalid and shows the message of a failed rule', () => {
    const wrapper = mountInput(null, { error: 'Выберите дату' });

    expect(wrapper.get('[data-field-error]').text()).toBe('Выберите дату');
    expect(wrapper.getComponent(DatePickerStub).props('invalid')).toBe(true);
  });

  it('shows neither a message nor an invalid date without an error', () => {
    const wrapper = mountInput(new Date(2026, 8, 13, 9, 45, 30));

    expect(wrapper.find('[data-field-error]').exists()).toBe(false);
    expect(wrapper.getComponent(DatePickerStub).props('invalid')).toBe(false);
  });

  it('shows a warning under the field without marking the date invalid', () => {
    const wrapper = mountInput(new Date(2026, 8, 13), { warning: 'Раньше даты покупки' });

    expect(wrapper.text()).toContain('Раньше даты покупки');
    expect(wrapper.find('[data-field-error]').exists()).toBe(false);
    expect(wrapper.getComponent(DatePickerStub).props('invalid')).toBe(false);
  });

  it('shows only the error when there is a warning as well', () => {
    const wrapper = mountInput(null, { error: 'Выберите дату', warning: 'Раньше даты покупки' });

    expect(wrapper.get('[data-field-error]').text()).toBe('Выберите дату');
    expect(wrapper.text()).not.toContain('Раньше даты покупки');
  });

  it('shows no note under the field without a warning', () => {
    const wrapper = mountInput(new Date(2026, 8, 13));

    expect(wrapper.find('small').exists()).toBe(false);
  });

  it('marks a required date with an asterisk and leaves an optional one plain', () => {
    expect(mountInput(null, { required: true }).get('label').text()).toBe('Дата*');
    expect(mountInput(null).get('label').text()).toBe('Дата');
  });
});
