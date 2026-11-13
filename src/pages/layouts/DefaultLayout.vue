<script setup lang="ts">
import AppMenu from './components/AppMenu.vue';
import DefaultHeader from './components/DefaultHeader.vue';
import { isKeyboardOpen } from '@/services/keyboard';
</script>

<template>
  <DefaultHeader class="fixed top-0 right-0 left-0 z-40" />

  <!-- overflow-x guard: a horizontal pan in a fixed-width WebView reads as broken, and the user has
       no browser chrome to recover with. bottom-* mirrors AppMenu's tiered height and collapses
       with it while the IME is up -->
  <main
    :class="isKeyboardOpen ? 'bottom-0' : 'w360:bottom-16.25 bottom-14.25'"
    class="bg-app px-column-4 absolute inset-x-0 top-16 overflow-x-hidden overflow-y-auto"
  >
    <RouterView />
  </main>

  <AppMenu v-show="!isKeyboardOpen" class="fixed right-0 bottom-0 left-0 z-40" />
</template>
