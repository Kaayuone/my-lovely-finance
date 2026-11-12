import type { Category, CategoryRow } from './category.types';

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    code: row.code,
    name: row.name,
    isHidden: Boolean(row.is_hidden),
    sortOrder: row.sort_order,
  };
}
