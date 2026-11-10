<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue';
import Button from 'primevue/button';
import HeaderShell from './HeaderShell.vue';
import { useRoute, useRouter } from 'vue-router';
import { computed } from 'vue';
import { APP_TITLE } from '@/constants/app';

const route = useRoute();
const router = useRouter();

const headerTitle = computed(() => route.meta.title ?? APP_TITLE);

// Back through the history when the page was reached inside the app, so this button and the
// hardware one agree; a page opened directly goes to its parent instead of leaving the app
function onBack() {
  const { backTo } = route.meta;
  if (!backTo) return;

  if (router.options.history.state.back) router.back();
  else void router.replace({ name: backTo });
}
</script>

<template>
  <HeaderShell :title="headerTitle">
    <template v-if="route.meta.backTo" #start>
      <Button aria-label="Назад" severity="secondary" text rounded @click="onBack">
        <ArrowLeft :size="24" aria-hidden="true" />
      </Button>
    </template>
  </HeaderShell>
</template>
