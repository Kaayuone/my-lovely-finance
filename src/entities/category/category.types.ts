import type { Audit } from '@/entities/types';
import type { CategoryKind } from '@/types/finance';

export interface NewCategoryRow {
  parent_id: number | null;
  kind: CategoryKind;
  // Only a built-in category has a code; an own one is always a subcategory (ADR-0006)
  code: string | null;
  name: string;
  is_hidden: number;
  sort_order: number;
}

export interface CategoryRow extends NewCategoryRow, Audit {
  id: number;
}

export type Category = {
  id: number;
  parentId: number | null;
  kind: CategoryKind;
  code: string | null;
  name: string;
  isHidden: boolean;
  sortOrder: number;
};
