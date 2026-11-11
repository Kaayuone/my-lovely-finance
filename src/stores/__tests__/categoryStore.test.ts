import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createDeferred } from '@/__tests__/deferred';
import type { Category } from '@/entities/category/category.types';

const categoryRepository = vi.hoisted(() => ({
  getCategories: vi.fn(),
  insertSubcategory: vi.fn(),
  renameSubcategory: vi.fn(),
  setCategoryHidden: vi.fn(),
  deleteSubcategory: vi.fn(),
}));

vi.mock('@/entities/category/category.repository', () => categoryRepository);

import { useCategoryStore } from '@/stores/categoryStore';

function category(id: number, changes: Partial<Category> = {}): Category {
  return {
    id,
    parentId: null,
    kind: 'expense',
    code: `category_${id}`,
    name: `Категория ${id}`,
    isHidden: false,
    sortOrder: id,
    ...changes,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  categoryRepository.getCategories.mockResolvedValue([category(1)]);
});

describe('categoryStore', () => {
  it('loads the flat list under loading and propagates a failed reload', async () => {
    const pending = createDeferred<Category[]>();
    categoryRepository.getCategories.mockReturnValueOnce(pending.promise);
    const store = useCategoryStore();

    const load = store.loadCategories();
    expect(store.loading).toBe(true);
    pending.resolve([category(1)]);
    await load;
    expect(store.categories).toEqual([category(1)]);
    expect(store.loading).toBe(false);

    const error = new Error('Read failed');
    categoryRepository.getCategories.mockRejectedValueOnce(error);
    await expect(store.loadCategories()).rejects.toBe(error);
    expect(store.loading).toBe(false);
    expect(store.categories).toEqual([category(1)]);
  });

  it('builds separate two-level trees ordered by sortOrder without changing the flat list', async () => {
    const expenseMain = category(1, { sortOrder: 20 });
    const firstExpense = category(2, { sortOrder: 10 });
    const expenseChild = category(3, { parentId: 1, code: null, sortOrder: 20 });
    const firstExpenseChild = category(4, { parentId: 1, code: null, sortOrder: 10 });
    const hiddenExpenseChild = category(5, { parentId: 2, code: null, isHidden: true });
    const incomeMain = category(6, { kind: 'income', sortOrder: 20 });
    const incomeChild = category(7, { parentId: 6, kind: 'income', code: null, sortOrder: 20 });
    const firstIncome = category(8, { kind: 'income', sortOrder: 10 });
    const firstIncomeChild = category(9, {
      parentId: 6,
      kind: 'income',
      code: null,
      sortOrder: 10,
    });
    const flat = [
      incomeChild,
      expenseChild,
      incomeMain,
      expenseMain,
      firstExpenseChild,
      firstIncome,
      hiddenExpenseChild,
      firstExpense,
      firstIncomeChild,
    ];
    categoryRepository.getCategories.mockResolvedValueOnce(flat);
    const store = useCategoryStore();

    await store.loadCategories();

    expect(store.expenseTree).toEqual([
      { ...firstExpense, children: [hiddenExpenseChild] },
      { ...expenseMain, children: [firstExpenseChild, expenseChild] },
    ]);
    expect(store.incomeTree).toEqual([
      { ...firstIncome, children: [] },
      { ...incomeMain, children: [firstIncomeChild, incomeChild] },
    ]);
    expect(store.categories).toEqual(flat);

    categoryRepository.getCategories.mockResolvedValueOnce([]);
    await store.loadCategories();
    expect(store.expenseTree).toEqual([]);
    expect(store.incomeTree).toEqual([]);
  });

  const mutations = [
    {
      name: 'addSubcategory',
      invoke: (store: ReturnType<typeof useCategoryStore>) =>
        store.addSubcategory(1, 'Подкатегория'),
      repository: categoryRepository.insertSubcategory,
      args: [1, 'Подкатегория'],
      result: 12,
    },
    {
      name: 'renameSubcategory',
      invoke: (store: ReturnType<typeof useCategoryStore>) =>
        store.renameSubcategory(1, 'Новое имя'),
      repository: categoryRepository.renameSubcategory,
      args: [1, 'Новое имя'],
      result: undefined,
    },
    {
      name: 'setCategoryHidden',
      invoke: (store: ReturnType<typeof useCategoryStore>) => store.setCategoryHidden(1, true),
      repository: categoryRepository.setCategoryHidden,
      args: [1, true],
      result: undefined,
    },
    {
      name: 'deleteSubcategory',
      invoke: (store: ReturnType<typeof useCategoryStore>) => store.deleteSubcategory(1),
      repository: categoryRepository.deleteSubcategory,
      args: [1],
      result: undefined,
    },
  ];

  it.each(mutations)(
    '$name forwards arguments without changing or reloading categories',
    async mutation => {
      const store = useCategoryStore();
      await store.loadCategories();
      const pending = createDeferred<number | undefined>();
      mutation.repository.mockReturnValueOnce(pending.promise);

      const write = mutation.invoke(store);
      expect(store.loading).toBe(true);
      expect(mutation.repository).toHaveBeenCalledExactlyOnceWith(...mutation.args);
      pending.resolve(mutation.result);
      await expect(write).resolves.toBe(mutation.result);

      expect(store.loading).toBe(false);
      expect(store.categories).toEqual([category(1)]);
      expect(categoryRepository.getCategories).toHaveBeenCalledOnce();
    },
  );

  it.each(mutations)('$name propagates repository errors and releases loading', async mutation => {
    const store = useCategoryStore();
    const error = new Error('Write failed');
    mutation.repository.mockRejectedValueOnce(error);

    await expect(mutation.invoke(store)).rejects.toBe(error);

    expect(store.loading).toBe(false);
  });
});
