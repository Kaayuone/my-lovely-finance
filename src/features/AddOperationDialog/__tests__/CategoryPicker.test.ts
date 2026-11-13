// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { ButtonStub, DialogStub } from '@/components/__tests__/testStubs';
import CategoryPicker from '../components/CategoryPicker.vue';
import { dispatchHardwareBack } from '@/services/hardwareBack';
import { useCategoryStore } from '@/stores/categoryStore';

import type { Pinia } from 'pinia';
import type { Category } from '@/entities/category/category.types';

const categoryRepository = vi.hoisted(() => ({ getCategories: vi.fn() }));

vi.mock('@/entities/category/category.repository', () => categoryRepository);

const FOOD = category(1, 'Еда и напитки');
const GROCERIES = category(11, 'Продукты', { parentId: FOOD.id });
const FAST_FOOD = category(12, 'Фастфуд', { parentId: FOOD.id, isHidden: true });
const TELECOM = category(2, 'Связь');
const MOBILE = category(21, 'Мобильная связь', { parentId: TELECOM.id, isHidden: true });
const PETS = category(3, 'Питомцы', { isHidden: true });
const PET_FOOD = category(31, 'Корм', { parentId: PETS.id });
const SALARY = category(4, 'Зарплата', { kind: 'income' });

let pinia: Pinia;

function category(id: number, name: string, changes: Partial<Category> = {}): Category {
  return {
    id,
    parentId: null,
    kind: 'expense',
    code: null,
    name,
    isHidden: false,
    sortOrder: id,
    ...changes,
  };
}

function mountPicker(modelValue: number | null = null) {
  const wrapper = mount(CategoryPicker, {
    props: {
      id: 'operation_category',
      kind: 'expense',
      modelValue,
      required: true,
      'onUpdate:modelValue': (value: number | null) => {
        void wrapper.setProps({ modelValue: value });
      },
    },
    global: {
      plugins: [pinia],
      stubs: { Button: ButtonStub, Dialog: DialogStub },
    },
  });
  return wrapper;
}

type PickerWrapper = ReturnType<typeof mountPicker>;

async function openPicker(wrapper: PickerWrapper) {
  await wrapper.get('#operation_category').trigger('click');
}

function findDialog(wrapper: PickerWrapper) {
  return wrapper.find('[data-testid="dialog"]');
}

function rowTexts(wrapper: PickerWrapper): string[] {
  return findDialog(wrapper)
    .findAll('[role="button"]')
    .map(row => row.text());
}

async function tapRow(wrapper: PickerWrapper, text: string) {
  const row = findDialog(wrapper)
    .findAll('[role="button"]')
    .find(item => item.text() === text);
  if (!row) throw new Error(`Row not found: ${text}`);
  await row.trigger('click');
}

async function pressBack() {
  expect(dispatchHardwareBack()).toBe(true);
  await nextTick();
}

enableAutoUnmount(afterEach);

beforeEach(async () => {
  pinia = createPinia();
  setActivePinia(pinia);
  categoryRepository.getCategories.mockResolvedValue([
    FOOD,
    GROCERIES,
    FAST_FOOD,
    TELECOM,
    MOBILE,
    PETS,
    PET_FOOD,
    SALARY,
  ]);
  await useCategoryStore().loadCategories();
});

describe('CategoryPicker', () => {
  it('shows the selected subcategory with its main category, or a muted prompt', () => {
    expect(mountPicker(GROCERIES.id).get('#operation_category').text()).toBe(
      'Еда и напитки › Продукты',
    );
    expect(mountPicker(TELECOM.id).get('#operation_category').text()).toBe('Связь');
    expect(mountPicker().get('#operation_category_value').classes()).toContain('text-muted-color');
    expect(mountPicker().get('#operation_category').text()).toBe('Выберите категорию');
  });

  it('lists the main categories of its kind without the hidden ones', async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);

    expect(findDialog(wrapper).get('h2').text()).toBe('Категория');
    expect(rowTexts(wrapper)).toEqual(['Еда и напитки', 'Связь']);

    await tapRow(wrapper, 'Еда и напитки');

    expect(rowTexts(wrapper)).toEqual(['Вся категория «Еда и напитки»', 'Продукты']);
  });

  it('keeps a selected hidden category and the path to it in the list', async () => {
    const hiddenSubcategory = mountPicker(FAST_FOOD.id);
    await openPicker(hiddenSubcategory);
    await tapRow(hiddenSubcategory, 'Еда и напитки');

    expect(rowTexts(hiddenSubcategory)).toEqual([
      'Вся категория «Еда и напитки»',
      'Продукты',
      'Фастфуд',
    ]);

    const underHiddenMain = mountPicker(PET_FOOD.id);
    await openPicker(underHiddenMain);

    expect(rowTexts(underHiddenMain)).toEqual(['Еда и напитки', 'Связь', 'Питомцы']);
  });

  it('offers a hidden main category only when it is the selected one', async () => {
    const asPath = mountPicker(PET_FOOD.id);
    await openPicker(asPath);
    await tapRow(asPath, 'Питомцы');

    expect(findDialog(asPath).get('h2').text()).toBe('Питомцы');
    expect(rowTexts(asPath)).toEqual(['Корм']);

    const asSelected = mountPicker(PETS.id);
    await openPicker(asSelected);

    expect(rowTexts(asSelected)).toEqual(['Еда и напитки', 'Связь', 'Питомцы']);

    await tapRow(asSelected, 'Питомцы');

    expect(asSelected.emitted('update:modelValue')).toBeUndefined();
    expect(findDialog(asSelected).exists()).toBe(false);
    expect(asSelected.get('#operation_category').text()).toBe('Питомцы');
  });

  it('picks a main category without visible subcategories with one tap', async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);
    await tapRow(wrapper, 'Связь');

    expect(wrapper.emitted('update:modelValue')).toEqual([[TELECOM.id]]);
    expect(findDialog(wrapper).exists()).toBe(false);
    expect(wrapper.get('#operation_category').text()).toBe('Связь');
  });

  it('picks the whole main category or a subcategory on the second screen', async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);
    await tapRow(wrapper, 'Еда и напитки');

    expect(findDialog(wrapper).get('h2').text()).toBe('Еда и напитки');

    await tapRow(wrapper, 'Продукты');

    expect(wrapper.emitted('update:modelValue')).toEqual([[GROCERIES.id]]);
    expect(findDialog(wrapper).exists()).toBe(false);

    await openPicker(wrapper);
    await tapRow(wrapper, 'Еда и напитки');
    await tapRow(wrapper, 'Вся категория «Еда и напитки»');

    expect(wrapper.emitted('update:modelValue')).toEqual([[GROCERIES.id], [FOOD.id]]);
    expect(wrapper.get('#operation_category').text()).toBe('Еда и напитки');
  });

  // The rows of the second screen carry no other icon than the check
  it('marks the selected category with a check', async () => {
    const wrapper = mountPicker(GROCERIES.id);
    await openPicker(wrapper);
    await tapRow(wrapper, 'Еда и напитки');

    const rows = findDialog(wrapper).findAll('[role="button"]');
    expect(rows.map(row => row.find('svg').exists())).toEqual([false, true]);
  });

  it('goes back from the second screen to the first, then closes', async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);
    await tapRow(wrapper, 'Еда и напитки');

    await pressBack();

    expect(findDialog(wrapper).get('h2').text()).toBe('Категория');
    expect(rowTexts(wrapper)).toEqual(['Еда и напитки', 'Связь']);

    await pressBack();

    expect(findDialog(wrapper).exists()).toBe(false);
    expect(dispatchHardwareBack()).toBe(false);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('opens on the first screen again after closing on the second one', async () => {
    const wrapper = mountPicker();
    await openPicker(wrapper);
    await tapRow(wrapper, 'Еда и напитки');
    wrapper.getComponent(DialogStub).vm.$emit('update:visible', false);
    await nextTick();

    expect(findDialog(wrapper).exists()).toBe(false);

    await openPicker(wrapper);

    expect(rowTexts(wrapper)).toEqual(['Еда и напитки', 'Связь']);
  });
});
