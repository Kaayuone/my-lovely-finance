// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CurrencySelect from '@/components/CurrencySelect.vue';

function mountSelect(error?: string, required = false) {
  return mount(CurrencySelect, {
    props: {
      id: 'currency',
      modelValue: 'BYN',
      error,
      required,
      class: 'min-w-0 flex-1',
    },
    global: {
      stubs: {
        Select: {
          name: 'Select',
          props: ['modelValue', 'options', 'invalid', 'pt'],
          emits: ['update:modelValue'],
          template:
            '<button type="button" @click="$emit(\'update:modelValue\', \'EUR\')"><slot name="value" :value="modelValue" /></button>',
        },
      },
    },
  });
}

describe('CurrencySelect', () => {
  it('shows the code in the trigger and exposes full labels in a wide overlay', () => {
    const wrapper = mountSelect();
    const select = wrapper.getComponent({ name: 'Select' });

    expect(wrapper.classes()).toEqual(['min-w-0', 'flex-1']);
    expect(wrapper.classes()).not.toContain('w-full');
    expect(wrapper.get('button').text()).toBe('BYN');
    expect(select.props('options')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BYN', label: 'BYN — белорусский рубль' }),
        expect.objectContaining({ code: 'EUR', label: 'EUR — евро' }),
      ]),
    );
    expect(select.props('pt')).toEqual({
      overlay: { class: 'w-[min(16rem,calc(100vw-2rem))]' },
    });
  });

  it('marks the label only where the field is mandatory', () => {
    expect(mountSelect().get('label').text()).toBe('Валюта');
    expect(mountSelect(undefined, true).get('label').text()).toBe('Валюта*');
  });

  it('updates the model and renders validation errors', async () => {
    const wrapper = mountSelect('Выберите валюту');

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['EUR']]);
    expect(wrapper.text()).toContain('Выберите валюту');
    expect(wrapper.getComponent({ name: 'Select' }).props('invalid')).toBe(true);
  });
});
