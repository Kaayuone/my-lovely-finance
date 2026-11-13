// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import InputAmountField from '@/components/InputAmountField.vue';
import { FloatLabelStub, InputTextStub } from './testStubs';

function mountField(
  modelValue: string,
  props: { currency?: string | null; error?: string; signed?: boolean } = {},
) {
  // The parent applies every emitted value, as v-model does
  const wrapper = mount(InputAmountField, {
    props: {
      id: 'amount',
      label: 'Сумма*',
      currency: 'BYN',
      modelValue,
      'onUpdate:modelValue': (value: string) => {
        void wrapper.setProps({ modelValue: value });
      },
      ...props,
    },
    global: {
      stubs: {
        FloatLabel: FloatLabelStub,
        InputText: InputTextStub,
      },
    },
  });
  return wrapper;
}

function signButton(wrapper: ReturnType<typeof mountField>) {
  return wrapper.find('button[aria-label="Сменить знак"]');
}

describe('InputAmountField', () => {
  it('opens a decimal keyboard on an input tied to its label', () => {
    const wrapper = mountField('');
    const input = wrapper.get('input');

    expect(wrapper.get('label').attributes('for')).toBe('amount');
    expect(wrapper.get('label').text()).toBe('Сумма*');
    expect(input.attributes('id')).toBe('amount');
    expect(input.attributes('inputmode')).toBe('decimal');
    expect(input.attributes('autocomplete')).toBe('off');
  });

  it.each(['1 234,5', ' 12.50 ', '-0,05', 'abc'])(
    'hands %j to the model exactly as typed',
    async text => {
      const wrapper = mountField('');

      await wrapper.get('input').setValue(text);

      expect(wrapper.emitted('update:modelValue')).toEqual([[text]]);
    },
  );

  it('shows the currency code at the end of the field until there is no currency', async () => {
    const wrapper = mountField('12,50');

    expect(wrapper.text()).toContain('BYN');

    await wrapper.setProps({ currency: 'USD' });
    expect(wrapper.text()).toContain('USD');

    await wrapper.setProps({ currency: null });
    expect(wrapper.text()).not.toMatch(/[A-Z]{3}/);
  });

  it('puts a leading minus on and takes it off with the sign button', async () => {
    const wrapper = mountField('12,5', { signed: true });

    expect(signButton(wrapper).attributes('disabled')).toBeUndefined();

    await signButton(wrapper).trigger('click');
    expect(wrapper.get('input').element.value).toBe('-12,5');

    await signButton(wrapper).trigger('click');
    expect(wrapper.get('input').element.value).toBe('12,5');

    expect(wrapper.emitted('update:modelValue')).toEqual([['-12,5'], ['12,5']]);
  });

  it.each([
    ['', '-'],
    ['+5', '-5'],
    [' 7', ' -7'],
    [' -7', ' 7'],
  ])('turns %j into %j with the sign button', async (before, after) => {
    const wrapper = mountField(before, { signed: true });

    await signButton(wrapper).trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[after]]);
  });

  it.each([true, ''])('keeps the sign of a disabled field (disabled: %j)', async disabled => {
    const wrapper = mount(InputAmountField, {
      props: { id: 'amount', label: 'Сумма', currency: 'BYN', modelValue: '12,5', signed: true },
      attrs: { disabled },
      global: { stubs: { FloatLabel: FloatLabelStub, InputText: InputTextStub } },
    });
    const button = wrapper.get('button[aria-label="Сменить знак"]');

    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
    expect(button.attributes('disabled')).toBeDefined();

    await button.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('has no sign button for an amount that cannot be negative', () => {
    expect(signButton(mountField('12,5')).exists()).toBe(false);
  });

  it('marks the input invalid and shows the message of a failed rule', () => {
    const wrapper = mountField('0', { error: 'Сумма должна быть больше нуля' });

    expect(wrapper.get('[data-field-error]').text()).toBe('Сумма должна быть больше нуля');
    expect(wrapper.get('input').attributes('invalid')).toBe('true');
  });

  it('shows neither a message nor an invalid input without an error', () => {
    const wrapper = mountField('12,50');

    expect(wrapper.find('[data-field-error]').exists()).toBe(false);
    expect(wrapper.get('input').attributes('invalid')).toBe('false');
  });

  it('gives its class to the wrapper and the other attributes to the input', () => {
    const wrapper = mount(InputAmountField, {
      props: { id: 'fee', label: 'Комиссия', currency: 'BYN', modelValue: '' },
      attrs: { class: 'flex-1', 'aria-describedby': 'fee-hint' },
      global: { stubs: { FloatLabel: FloatLabelStub, InputText: InputTextStub } },
    });

    expect(wrapper.classes()).toContain('flex-1');
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('fee-hint');
    expect(wrapper.get('input').classes()).not.toContain('flex-1');
  });
});
