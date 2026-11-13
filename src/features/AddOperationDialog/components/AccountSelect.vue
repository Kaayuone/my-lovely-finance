<script setup lang="ts">
import FloatLabel from 'primevue/floatlabel';
import Select from 'primevue/select';
import FieldError from '@/components/FieldError.vue';
import { useAccountStore } from '@/stores/accountStore';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

// `keptAccountIds`: archived accounts the edited operation refers to. The list offers active
// accounts only, but an operation of an archived account still opens with it selected.
const {
  id,
  label,
  error,
  keptAccountIds = [],
} = defineProps<{
  id: string;
  label: string;
  error?: string;
  keptAccountIds?: readonly number[];
}>();

const model = defineModel<number | null>({ required: true });

const { accounts } = storeToRefs(useAccountStore());

const options = computed(() =>
  accounts.value
    .filter(account => !account.isArchived || keptAccountIds.includes(account.id))
    .map(account => ({ id: account.id, label: `${account.name} · ${account.currency}` })),
);
</script>

<template>
  <div class="w-full">
    <FloatLabel variant="on">
      <Select
        v-model="model"
        :input-id="id"
        :invalid="Boolean(error)"
        :options
        :pt="{
          overlay: { class: 'max-w-[calc(100vw-2rem)]' },
          option: { class: 'whitespace-normal wrap-break-word' },
        }"
        option-label="label"
        option-value="id"
        fluid
      />
      <label :for="id">{{ label }}</label>
    </FloatLabel>

    <FieldError :message="error" class="mt-1 block" />
  </div>
</template>
