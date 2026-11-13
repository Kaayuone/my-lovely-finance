<script setup lang="ts">
import { Check, ChevronRight } from '@lucide/vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import DialogFocusGuard from '@/components/DialogFocusGuard.vue';
import FieldError from '@/components/FieldError.vue';

import { useCategoryStore } from '@/stores/categoryStore';
import {
  useHardwareBackHandler,
  HARDWARE_BACK_PRIORITY_DRAWER_DIALOG,
} from '@/services/hardwareBack';

import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

import type { Category } from '@/entities/category/category.types';
import type { CategoryNode } from '@/stores/categoryStore';
import type { CategoryKind } from '@/types/finance';

import { CATEGORY_PATH_SEPARATOR, PICKER_DIALOG_PT, PICKER_TRIGGER_CLASS } from '../constants';

const {
  id,
  kind,
  error,
  required = false,
} = defineProps<{
  id: string;
  kind: CategoryKind;
  error?: string;
  required?: boolean;
}>();

const model = defineModel<number | null>({ required: true });

const isOpen = ref(false);
// The main category whose subcategories the second screen lists; null on the first screen
const openedParentId = ref<number | null>(null);

const { categories, expenseTree, incomeTree } = storeToRefs(useCategoryStore());

// The second screen goes back to the first one before the picker closes
useHardwareBackHandler({
  priority: HARDWARE_BACK_PRIORITY_DRAWER_DIALOG,
  isActive: () => isOpen.value,
  onBack: () => {
    if (openedParentId.value !== null) openedParentId.value = null;
    else isOpen.value = false;
  },
});

const label = computed(() => `Категория${required ? '*' : ''}`);
const categoriesById = computed(
  () => new Map(categories.value.map(category => [category.id, category])),
);
const selectedPath = computed(() => {
  const selected = model.value === null ? undefined : categoriesById.value.get(model.value);
  if (!selected) return null;

  const parent =
    selected.parentId === null ? undefined : categoriesById.value.get(selected.parentId);
  return parent ? `${parent.name}${CATEGORY_PATH_SEPARATOR}${selected.name}` : selected.name;
});
// A hidden category is out of the choice, and a hidden main category takes its whole branch with
// it. Only the selected category stays, so the form never shows one the picker cannot find.
const shownTree = computed<CategoryNode[]>(() =>
  (kind === 'expense' ? expenseTree.value : incomeTree.value)
    .map(node => ({
      ...node,
      children: node.children.filter(
        child => isSelected(child) || (!child.isHidden && !node.isHidden),
      ),
    }))
    .filter(node => !node.isHidden || isSelected(node) || node.children.length > 0),
);
const openedParent = computed(
  () => shownTree.value.find(node => node.id === openedParentId.value) ?? null,
);
const dialogHeader = computed(() => openedParent.value?.name ?? 'Категория');

function openPicker() {
  openedParentId.value = null;
  isOpen.value = true;
}

// A main category without subcategories to show is chosen at once
function pickMain(node: CategoryNode) {
  if (node.children.length) openedParentId.value = node.id;
  else select(node);
}

function select(category: Category) {
  model.value = category.id;
  isOpen.value = false;
}

function isSelected(category: Category): boolean {
  return category.id === model.value;
}
</script>

<template>
  <div class="w-full">
    <span :id="`${id}_label`" class="text-muted-color mb-1 block text-xs">{{ label }}</span>

    <!-- `p-invalid` makes the trigger the scroll target of a failed save, like any invalid field -->
    <Button
      :id
      :class="[
        PICKER_TRIGGER_CLASS,
        error ? 'p-invalid not-disabled:border-invalid' : 'not-disabled:border-field-line',
      ]"
      :aria-labelledby="`${id}_label ${id}_value`"
      severity="secondary"
      aria-haspopup="dialog"
      outlined
      @click="openPicker"
    >
      <span
        :id="`${id}_value`"
        :class="!selectedPath && 'text-muted-color font-normal'"
        class="min-w-0 flex-1 text-left wrap-break-word"
      >
        {{ selectedPath ?? 'Выберите категорию' }}
      </span>

      <ChevronRight :size="16" class="text-muted-color shrink-0" aria-hidden="true" />
    </Button>

    <FieldError :message="error" class="mt-1 block" />

    <Dialog v-model:visible="isOpen" :pt="PICKER_DIALOG_PT" :header="dialogHeader" modal>
      <DialogFocusGuard />

      <template v-if="openedParent">
        <div
          role="button"
          class="active:bg-card flex w-full items-center gap-3 rounded-md px-2 py-3"
          @click="select(openedParent)"
        >
          <span class="min-w-0 flex-1 wrap-break-word">
            Вся категория «{{ openedParent.name }}»
          </span>

          <Check
            v-if="isSelected(openedParent)"
            :size="18"
            class="text-primary shrink-0"
            aria-hidden="true"
          />
        </div>

        <hr class="text-line my-1" />

        <div
          v-for="child in openedParent.children"
          :key="child.id"
          role="button"
          class="active:bg-card flex w-full items-center gap-3 rounded-md px-2 py-3"
          @click="select(child)"
        >
          <span class="min-w-0 flex-1 wrap-break-word">{{ child.name }}</span>

          <Check
            v-if="isSelected(child)"
            :size="18"
            class="text-primary shrink-0"
            aria-hidden="true"
          />
        </div>
      </template>

      <template v-else>
        <div
          v-for="node in shownTree"
          :key="node.id"
          role="button"
          class="active:bg-card flex w-full items-center gap-3 rounded-md px-2 py-3"
          @click="pickMain(node)"
        >
          <span class="min-w-0 flex-1 wrap-break-word">{{ node.name }}</span>

          <Check
            v-if="isSelected(node)"
            :size="18"
            class="text-primary shrink-0"
            aria-hidden="true"
          />
          <ChevronRight
            v-else-if="node.children.length"
            :size="16"
            class="text-muted-color shrink-0"
            aria-hidden="true"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>
