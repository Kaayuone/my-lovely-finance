import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import * as categoryRepository from '@/entities/category/category.repository';

import type { Category } from '@/entities/category/category.types';
import type { CategoryKind } from '@/types/finance';

export type CategoryNode = Category & { children: Category[] };

export const useCategoryStore = defineStore('categories', () => {
  const categories = ref<Category[]>([]);
  const loading = ref(false);

  const expenseTree = computed(() => buildTree('expense'));
  const incomeTree = computed(() => buildTree('income'));

  function buildTree(kind: CategoryKind): CategoryNode[] {
    const sortedCategories = categories.value
      .filter(category => category.kind === kind)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

    return sortedCategories
      .filter(category => category.parentId === null)
      .map(category => ({
        ...category,
        children: sortedCategories.filter(child => child.parentId === category.id),
      }));
  }

  async function loadCategories() {
    loading.value = true;
    try {
      categories.value = await categoryRepository.getCategories();
    } finally {
      loading.value = false;
    }
  }

  async function addSubcategory(parentId: number, name: string) {
    loading.value = true;
    try {
      return await categoryRepository.insertSubcategory(parentId, name);
    } finally {
      loading.value = false;
    }
  }

  async function renameSubcategory(id: number, name: string) {
    loading.value = true;
    try {
      await categoryRepository.renameSubcategory(id, name);
    } finally {
      loading.value = false;
    }
  }

  async function setCategoryHidden(id: number, hidden: boolean) {
    loading.value = true;
    try {
      await categoryRepository.setCategoryHidden(id, hidden);
    } finally {
      loading.value = false;
    }
  }

  async function deleteSubcategory(id: number) {
    loading.value = true;
    try {
      await categoryRepository.deleteSubcategory(id);
    } finally {
      loading.value = false;
    }
  }

  return {
    categories,
    loading,
    expenseTree,
    incomeTree,
    loadCategories,
    addSubcategory,
    renameSubcategory,
    setCategoryHidden,
    deleteSubcategory,
  };
});
