import { executeSql, querySql, runInTransaction } from '@/database';
import { rowToCategory } from './category.mapper';
import type { Category, CategoryRow, NewCategoryRow } from './category.types';

export async function getCategories(): Promise<Category[]> {
  const res = await querySql<CategoryRow>('SELECT * FROM categories ORDER BY kind, sort_order, id');
  return (res ?? []).map(rowToCategory);
}

export async function getCategoryByCode(code: string): Promise<Category | null> {
  const res = await querySql<CategoryRow>('SELECT * FROM categories WHERE code = ?', [code]);
  const row = res[0];
  return row ? rowToCategory(row) : null;
}

async function findCategoryById(id: number): Promise<Category | null> {
  const res = await querySql<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
  const row = res[0];
  return row ? rowToCategory(row) : null;
}

// The parent is read first instead of `INSERT … SELECT`: an insert of no rows would leave the
// `lastId` of an earlier one. A parent that is itself a subcategory is refused by the database.
export async function insertSubcategory(parentId: number, name: string): Promise<number> {
  return runInTransaction(async () => {
    const parent = await findCategoryById(parentId);
    if (!parent) throw new Error('Parent category not found');

    const siblings = await querySql<{ max_sort_order: number | null }>(
      'SELECT MAX(sort_order) AS max_sort_order FROM categories WHERE parent_id = ?',
      [parent.id],
    );
    const row: NewCategoryRow = {
      parent_id: parent.id,
      kind: parent.kind,
      code: null,
      name: name.trim(),
      is_hidden: 0,
      sort_order: (siblings[0]?.max_sort_order ?? 0) + 1,
    };

    const result = await executeSql(
      `INSERT INTO categories (parent_id, kind, code, name, is_hidden, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.parent_id, row.kind, row.code, row.name, row.is_hidden, row.sort_order],
      false,
    );

    const id = result.changes?.lastId;
    if (!id) throw new Error('Failed to get the ID of the new record');
    return id;
  });
}

export async function renameSubcategory(id: number, name: string): Promise<void> {
  await runInTransaction(async () => {
    const category = await findCategoryById(id);
    if (!category) throw new Error('Category not found');
    if (category.code !== null) throw new Error('Built-in categories cannot be renamed');

    await executeSql(
      'UPDATE categories SET name = ? WHERE id = ? AND code IS NULL',
      [name.trim(), id],
      false,
    );
  });
}

export async function setCategoryHidden(id: number, hidden: boolean): Promise<void> {
  await runInTransaction(async () => {
    await executeSql(
      'UPDATE categories SET is_hidden = ? WHERE id = ?',
      [hidden ? 1 : 0, id],
      false,
    );
  });
}

// An own category is always a subcategory (the table CHECK), so its operations and fees always
// have a main category to move to; the move and the delete commit together (ADR-0006)
export async function deleteSubcategory(id: number): Promise<void> {
  await runInTransaction(async () => {
    const category = await findCategoryById(id);
    if (!category) throw new Error('Category not found');
    if (category.code !== null) throw new Error('Built-in categories cannot be deleted');

    await executeSql(
      'UPDATE operations SET category_id = ? WHERE category_id = ?',
      [category.parentId, id],
      false,
    );
    await executeSql(
      'UPDATE operations SET fee_category_id = ? WHERE fee_category_id = ?',
      [category.parentId, id],
      false,
    );
    await executeSql('DELETE FROM categories WHERE id = ? AND code IS NULL', [id], false);
  });
}
