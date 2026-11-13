// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { dispatchHardwareBack } from '@/services/hardwareBack/hardwareBack.service';
import { useHardwareBackHandler } from '@/services/hardwareBack/useHardwareBackHandler';

// A sheet on a priority all the sheets of a test share
function mountSheet(open = false) {
  const isOpen = ref(open);
  const onBack = vi.fn(() => {
    isOpen.value = false;
  });

  const wrapper = mount(
    defineComponent({
      setup() {
        useHardwareBackHandler({ priority: 200, isActive: () => isOpen.value, onBack });
        return () => null;
      },
    }),
  );

  return { isOpen, onBack, wrapper };
}

enableAutoUnmount(afterEach);

describe('useHardwareBackHandler', () => {
  it('takes the back only while open', () => {
    const sheet = mountSheet();

    expect(dispatchHardwareBack()).toBe(false);

    sheet.isOpen.value = true;
    expect(dispatchHardwareBack()).toBe(true);
    expect(sheet.onBack).toHaveBeenCalledOnce();

    expect(dispatchHardwareBack()).toBe(false);
  });

  it('takes the back right away when it mounts open', () => {
    const sheet = mountSheet(true);

    expect(dispatchHardwareBack()).toBe(true);
    expect(sheet.onBack).toHaveBeenCalledOnce();
  });

  it('lets the back go once unmounted while open', () => {
    const sheet = mountSheet();
    sheet.isOpen.value = true;

    sheet.wrapper.unmount();

    expect(dispatchHardwareBack()).toBe(false);
    expect(sheet.onBack).not.toHaveBeenCalled();
  });

  // Two sheets on one priority: the order they mounted in says nothing about which one is on top
  it('gives a tie to the sheet opened later when it also mounted later', () => {
    const [first, second] = [mountSheet(), mountSheet()];
    first.isOpen.value = true;
    second.isOpen.value = true;

    expect(dispatchHardwareBack()).toBe(true);
    expect(second.onBack).toHaveBeenCalledOnce();
    expect(first.onBack).not.toHaveBeenCalled();
  });

  it('gives a tie to the sheet opened later when it mounted first', () => {
    const [first, second] = [mountSheet(), mountSheet()];
    second.isOpen.value = true;
    first.isOpen.value = true;

    expect(dispatchHardwareBack()).toBe(true);
    expect(first.onBack).toHaveBeenCalledOnce();
    expect(second.onBack).not.toHaveBeenCalled();
  });

  it('puts a reopened sheet back on top', () => {
    const [first, second] = [mountSheet(), mountSheet()];
    second.isOpen.value = true;
    first.isOpen.value = true;

    second.isOpen.value = false;
    second.isOpen.value = true;

    expect(dispatchHardwareBack()).toBe(true);
    expect(second.onBack).toHaveBeenCalledOnce();
    expect(first.onBack).not.toHaveBeenCalled();
  });
});
