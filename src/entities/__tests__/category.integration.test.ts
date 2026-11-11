import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as categoryRepository from '@/entities/category/category.repository';
import {
  closeTestDatabase,
  executeSql,
  initializeTestDatabase,
  querySql,
  updateOnWeb,
} from '@/database/__tests__/sqliteTestDatabase';
import type { Category } from '@/entities/category/category.types';

vi.mock('@/database', async () => import('@/database/__tests__/sqliteTestDatabase'));

// 11 November 2026, 12:00 in Minsk
const OCCURRED_AT = 1_794_387_600_000;
const MINSK_OFFSET_MIN = 180;
const BUILT_IN_COUNT = 96;

type OperationCategories = {
  category_id: number | null;
  fee_category_id: number | null;
};

async function categoryByCode(code: string): Promise<Category> {
  const category = await categoryRepository.getCategoryByCode(code);
  if (!category) throw new Error(`No category with code ${code}`);
  return category;
}

async function categoryById(id: number): Promise<Category | undefined> {
  return (await categoryRepository.getCategories()).find(category => category.id === id);
}

async function countCategories(): Promise<number> {
  return (await categoryRepository.getCategories()).length;
}

// Operations have no repository yet, so the rows go in as plain SQL
async function insertRow(table: string, row: Record<string, unknown>): Promise<number> {
  const columns = Object.keys(row);
  const result = await executeSql(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row),
  );
  const id = result.changes.lastId;
  if (id === undefined) throw new Error('Failed to get the ID of the new record');
  return id;
}

async function operationCategories(id: number): Promise<OperationCategories | undefined> {
  const rows = await querySql<OperationCategories>(
    'SELECT category_id, fee_category_id FROM operations WHERE id = ?',
    [id],
  );
  return rows[0];
}

describe('category repository with SQLite', () => {
  let foodId: number;
  let groceriesId: number;

  beforeEach(async () => {
    await initializeTestDatabase();
    foodId = (await categoryByCode('food')).id;
    groceriesId = (await categoryByCode('food.groceries')).id;
  });

  afterEach(closeTestDatabase);

  describe('reading the built-in tree', () => {
    it('returns every built-in category, visible and coded, by kind, order and id', async () => {
      const categories = await categoryRepository.getCategories();

      expect(categories).toHaveLength(BUILT_IN_COUNT);
      expect(categories.every(category => !category.isHidden && category.code !== null)).toBe(true);
      expect(categories.filter(category => category.parentId === null)).toHaveLength(27);
      expect(categories).toEqual(
        [...categories].sort(
          (a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder || a.id - b.id,
        ),
      );
    });

    it('finds a subcategory by its code under its main category', async () => {
      const food = await categoryByCode('food');

      expect(food.name).toBe('Еда и напитки');
      expect(await categoryRepository.getCategoryByCode('food.fastfood')).toEqual({
        id: expect.any(Number),
        parentId: food.id,
        kind: 'expense',
        code: 'food.fastfood',
        name: 'Фастфуд',
        isHidden: false,
        sortOrder: 3,
      });
    });

    it('returns null for an unknown code', async () => {
      expect(await categoryRepository.getCategoryByCode('food.unknown')).toBeNull();
    });
  });

  describe('inserting an own subcategory', () => {
    it('takes the kind of its parent, a trimmed name and the place after its siblings', async () => {
      const coffeeId = await categoryRepository.insertSubcategory(foodId, '  Кофе  ');
      const teaId = await categoryRepository.insertSubcategory(foodId, 'Чай');
      const bonusId = await categoryRepository.insertSubcategory(
        (await categoryByCode('salary')).id,
        'Премия',
      );

      expect(await categoryById(coffeeId)).toEqual({
        id: coffeeId,
        parentId: foodId,
        kind: 'expense',
        code: null,
        name: 'Кофе',
        isHidden: false,
        sortOrder: 5,
      });
      expect(await categoryById(teaId)).toMatchObject({ sortOrder: 6 });
      expect(await categoryById(bonusId)).toMatchObject({ kind: 'income', sortOrder: 1 });
    });

    it('rejects a parent that does not exist and inserts nothing', async () => {
      await expect(categoryRepository.insertSubcategory(999_999, 'Кофе')).rejects.toThrow(
        'Parent category not found',
      );
      expect(await countCategories()).toBe(BUILT_IN_COUNT);
    });

    it('leaves a subcategory as a parent to the database to refuse', async () => {
      await expect(categoryRepository.insertSubcategory(groceriesId, 'Овощи')).rejects.toThrow(
        'category parent must be a main category of the same kind',
      );
      expect(await countCategories()).toBe(BUILT_IN_COUNT);
    });

    it('leaves a name repeated under the same parent to the database to refuse', async () => {
      await categoryRepository.insertSubcategory(foodId, 'Кофе');

      await expect(categoryRepository.insertSubcategory(foodId, 'Продукты')).rejects.toThrow(
        /UNIQUE constraint failed/,
      );
      await expect(categoryRepository.insertSubcategory(foodId, ' Кофе ')).rejects.toThrow(
        /UNIQUE constraint failed/,
      );
      expect(await countCategories()).toBe(BUILT_IN_COUNT + 1);
    });
  });

  describe('renaming and hiding', () => {
    it('renames an own subcategory', async () => {
      const id = await categoryRepository.insertSubcategory(foodId, 'Кофе');

      await categoryRepository.renameSubcategory(id, ' Кофейни ');

      expect(await categoryById(id)).toMatchObject({ name: 'Кофейни' });
    });

    it('refuses to rename a built-in category', async () => {
      await expect(
        categoryRepository.renameSubcategory(groceriesId, 'Супермаркеты'),
      ).rejects.toThrow('Built-in categories cannot be renamed');
      expect(await categoryById(groceriesId)).toMatchObject({ name: 'Продукты' });
    });

    it('hides a built-in category and shows it again', async () => {
      await categoryRepository.setCategoryHidden(groceriesId, true);
      expect(await categoryById(groceriesId)).toMatchObject({ isHidden: true });

      await categoryRepository.setCategoryHidden(groceriesId, false);
      expect(await categoryById(groceriesId)).toMatchObject({ isHidden: false });
    });
  });

  describe('deleting an own subcategory', () => {
    let cardId: number;
    let cashId: number;

    function insertExpense(categoryId: number): Promise<number> {
      return insertRow('operations', {
        kind: 'expense',
        account_id: cardId,
        amount_minor: -1250,
        category_id: categoryId,
        occurred_at: OCCURRED_AT,
        utc_offset_min: MINSK_OFFSET_MIN,
      });
    }

    function insertTransferWithFee(feeCategoryId: number): Promise<number> {
      return insertRow('operations', {
        kind: 'transfer',
        account_id: cardId,
        amount_minor: -10000,
        to_account_id: cashId,
        to_amount_minor: 10000,
        fee_minor: -150,
        fee_category_id: feeCategoryId,
        occurred_at: OCCURRED_AT,
        utc_offset_min: MINSK_OFFSET_MIN,
      });
    }

    beforeEach(async () => {
      cardId = await insertRow('accounts', { name: 'Карта', type: 'card', currency: 'BYN' });
      cashId = await insertRow('accounts', { name: 'Наличные', type: 'cash', currency: 'BYN' });
    });

    it('moves its operations and fees to the main category in one transaction', async () => {
      const coffeeId = await categoryRepository.insertSubcategory(foodId, 'Кофе');
      const expenseId = await insertExpense(coffeeId);
      const transferId = await insertTransferWithFee(coffeeId);
      const otherExpenseId = await insertExpense(groceriesId);
      updateOnWeb.mockClear();

      await categoryRepository.deleteSubcategory(coffeeId);

      expect(await operationCategories(expenseId)).toEqual({
        category_id: foodId,
        fee_category_id: null,
      });
      expect(await operationCategories(transferId)).toEqual({
        category_id: null,
        fee_category_id: foodId,
      });
      expect(await operationCategories(otherExpenseId)).toEqual({
        category_id: groceriesId,
        fee_category_id: null,
      });
      expect(await categoryById(coffeeId)).toBeUndefined();
      expect(updateOnWeb).toHaveBeenCalledTimes(1);
    });

    it('refuses to delete a built-in category and leaves its operations alone', async () => {
      const expenseId = await insertExpense(groceriesId);
      const transferId = await insertTransferWithFee(groceriesId);

      await expect(categoryRepository.deleteSubcategory(groceriesId)).rejects.toThrow(
        'Built-in categories cannot be deleted',
      );
      expect(await operationCategories(expenseId)).toEqual({
        category_id: groceriesId,
        fee_category_id: null,
      });
      expect(await operationCategories(transferId)).toEqual({
        category_id: null,
        fee_category_id: groceriesId,
      });
      expect(await categoryById(groceriesId)).toBeDefined();
    });

    it('rejects a category that does not exist', async () => {
      await expect(categoryRepository.deleteSubcategory(999_999)).rejects.toThrow(
        'Category not found',
      );
    });
  });
});
