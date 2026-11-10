<script setup lang="ts">
import HeaderShell from './HeaderShell.vue';
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import { APP_TITLE } from '@/constants/app';

const route = useRoute();

const headerTitle = computed(() => route.meta.title ?? APP_TITLE);
</script>

<template>
  <HeaderShell :title="headerTitle" />
</template>
