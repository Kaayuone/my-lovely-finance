// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import InputTextField from '@/components/InputTextField.vue';
import { FloatLabelStub, InputTextStub } from './testStubs';

describe('InputTextField', () => {
  it('forwards input updates and renders an associated label', async () => {
    const wrapper = mount(InputTextField, {
      props: {
        id: 'name',
        label: 'Название',
        modelValue: 'ABC',
      },
      global: {
        stubs: {
          FloatLabel: FloatLabelStub,
          InputText: InputTextStub,
        },
      },
    });

    expect(wrapper.get('label').attributes('for')).toBe('name');
    expect(wrapper.get('input').attributes('id')).toBe('name');

    await wrapper.get('input').setValue('xyz');
    expect(wrapper.emitted('update:modelValue')).toEqual([['xyz']]);
  });

  it('marks the input invalid and shows the message of a failed rule', () => {
    const wrapper = mount(InputTextField, {
      props: {
        id: 'name',
        label: 'Название счёта',
        modelValue: '',
        error: 'Введите название счёта',
      },
      global: {
        stubs: {
          FloatLabel: FloatLabelStub,
          InputText: InputTextStub,
        },
      },
    });

    expect(wrapper.get('[data-field-error]').text()).toBe('Введите название счёта');
    expect(wrapper.get('input').attributes('invalid')).toBe('true');
  });

  it('clears a non-empty value and hides the clear action for an empty value', async () => {
    const wrapper = mount(InputTextField, {
      props: {
        id: 'name',
        label: 'Имя',
        modelValue: 'Счёт',
      },
      global: {
        stubs: {
          FloatLabel: FloatLabelStub,
          InputText: InputTextStub,
        },
      },
    });

    const clearButton = wrapper.get('button[aria-label="Очистить"]');
    expect(clearButton.isVisible()).toBe(true);
    await clearButton.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['']]);

    await wrapper.setProps({ modelValue: '' });
    expect(wrapper.get('button[aria-label="Очистить"]').attributes('style')).toContain(
      'display: none',
    );
  });
});
