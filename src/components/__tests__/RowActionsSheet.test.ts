// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { Archive, Pencil, Trash2 } from '@lucide/vue';
import PrimeVue from 'primevue/config';
import RowActionsSheet from '@/components/RowActionsSheet.vue';
import {
  dispatchHardwareBack,
  registerHardwareBackHandler,
  unregisterHardwareBackHandler,
} from '@/services/hardwareBack';

import type { RowAction } from '@/components/RowActionsSheet.vue';

type ActionKey = 'edit' | 'archive' | 'delete';

const ACTIONS: RowAction<ActionKey>[] = [
  { value: 'edit', label: 'Изменить', icon: Pencil },
  { value: 'archive', label: 'В архив', icon: Archive },
  { value: 'delete', label: 'Удалить', icon: Trash2, danger: true },
];

const HEADER = 'Продукты и товары для дома';

// The drawer and the buttons are the real PrimeVue ones: the sheet is the PrimeVue markup, and the
// drawer's own focus on opening picks the first `[autofocus]` it finds in it
function mountSheet(modelValue = true) {
  const calls: string[] = [];
  const wrapper = mount(RowActionsSheet<ActionKey>, {
    props: {
      modelValue,
      header: HEADER,
      actions: ACTIONS,
      onSelect: (value: ActionKey) => calls.push(`select:${value}`),
      'onUpdate:modelValue': (value: boolean) => calls.push(`model:${value}`),
    },
    global: {
      plugins: [PrimeVue],
      stubs: { transition: false },
    },
  });

  return { calls, wrapper };
}

function findSheet() {
  return document.querySelector<HTMLElement>('.p-drawer');
}

function findActionButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.p-drawer-content button'));
}

enableAutoUnmount(afterEach);

describe('RowActionsSheet', () => {
  it('titles the sheet and lists the actions in the given order, without a close button', async () => {
    mountSheet();
    await vi.waitFor(() => expect(findSheet()).not.toBeNull());

    expect(document.querySelector('.p-drawer-title')?.textContent).toBe(HEADER);
    expect(findSheet()?.getAttribute('aria-label')).toBe(HEADER);
    expect(findActionButtons().map(button => button.textContent?.trim())).toEqual([
      'Изменить',
      'В архив',
      'Удалить',
    ]);
    expect(document.querySelectorAll('.p-drawer button')).toHaveLength(ACTIONS.length);
  });

  // The finger that opened the sheet is still held over it, and Android would select the title
  it('leaves nothing in the sheet to select', async () => {
    mountSheet();
    await vi.waitFor(() => expect(findSheet()).not.toBeNull());

    expect(findSheet()?.classList.contains('select-none')).toBe(true);
    expect(findSheet()?.classList.contains('[-webkit-touch-callout:none]')).toBe(true);
  });

  it('marks the destructive action as danger and focuses the first action on opening', async () => {
    mountSheet();
    await vi.waitFor(() => expect(findSheet()).not.toBeNull());

    const buttons = findActionButtons();

    expect(buttons.map(button => button.hasAttribute('autofocus'))).toEqual([true, false, false]);
    expect(buttons.map(button => button.classList.contains('p-button-danger'))).toEqual([
      false,
      false,
      true,
    ]);
    expect(buttons.map(button => button.classList.contains('p-button-secondary'))).toEqual([
      true,
      true,
      false,
    ]);
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[0]));
  });

  it('reports the tapped action and then closes', async () => {
    const { calls, wrapper } = mountSheet();
    await vi.waitFor(() => expect(findSheet()).not.toBeNull());

    findActionButtons()[2]?.click();

    expect(calls).toEqual(['select:delete', 'model:false']);
    expect(wrapper.emitted('select')).toEqual([['delete']]);
    expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
  });

  // The buttons stay on screen for the leave animation of the sheet
  it('ignores a tap on a sheet that is already closing', async () => {
    const { calls, wrapper } = mountSheet();
    await vi.waitFor(() => expect(findSheet()).not.toBeNull());
    const [firstButton] = findActionButtons();

    await wrapper.setProps({ modelValue: false });
    firstButton?.click();

    expect(calls).toEqual([]);
  });

  it('renders nothing while closed', () => {
    mountSheet(false);

    expect(findSheet()).toBeNull();
  });

  describe('hardware back', () => {
    it('closes the open sheet', async () => {
      const { calls, wrapper } = mountSheet();
      await vi.waitFor(() => expect(findSheet()).not.toBeNull());

      expect(dispatchHardwareBack()).toBe(true);
      expect(calls).toEqual(['model:false']);
      expect(wrapper.emitted('select')).toBeUndefined();
    });

    it('closes the sheet before the page handler under it', async () => {
      const pageBack = vi.fn();
      const pageId = Symbol('page');
      registerHardwareBackHandler({
        id: pageId,
        priority: 0,
        isActive: () => true,
        onBack: pageBack,
      });
      try {
        const { calls } = mountSheet();
        await vi.waitFor(() => expect(findSheet()).not.toBeNull());

        expect(dispatchHardwareBack()).toBe(true);
        expect(calls).toEqual(['model:false']);
        expect(pageBack).not.toHaveBeenCalled();
      } finally {
        unregisterHardwareBackHandler(pageId);
      }
    });

    it('is not taken by a closed sheet', () => {
      const { wrapper } = mountSheet(false);

      expect(dispatchHardwareBack()).toBe(false);
      expect(wrapper.emitted('update:model-value')).toBeUndefined();
    });
  });
});
