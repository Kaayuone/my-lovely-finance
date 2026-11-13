// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { Plus, Wallet } from '@lucide/vue';
import FabButton from '@/components/FabButton.vue';
import { ButtonStub } from './testStubs';

describe('FabButton', () => {
  it('names the add action and emits a click', async () => {
    const wrapper = mount(FabButton, {
      props: { label: 'Добавить счёт' },
      global: { stubs: { Button: ButtonStub } },
    });

    expect(wrapper.get('button').attributes('aria-label')).toBe('Добавить счёт');
    expect(wrapper.findComponent(Plus).exists()).toBe(true);

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('click')).toEqual([[]]);
  });

  it('uses the icon supplied by the caller', () => {
    const wrapper = mount(FabButton, {
      props: { label: 'Добавить счёт', icon: Wallet },
      global: { stubs: { Button: ButtonStub } },
    });

    expect(wrapper.findComponent(Wallet).exists()).toBe(true);
    expect(wrapper.findComponent(Plus).exists()).toBe(false);
  });
});
