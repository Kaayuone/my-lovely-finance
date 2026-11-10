<script setup lang="ts">
import AppMenu from './components/AppMenu.vue';
import DefaultHeader from './components/DefaultHeader.vue';
</script>

<template>
  <DefaultHeader class="fixed top-0 right-0 left-0 z-40" />

  <!-- overflow-x guard: a horizontal pan in a fixed-width WebView reads as broken, and the user has
       no browser chrome to recover with. bottom-* mirrors AppMenu's tiered height -->
  <main
    class="bg-app px-column-4 w360:bottom-16.25 absolute inset-x-0 top-16 bottom-14.25 overflow-x-hidden overflow-y-auto"
  >
    <RouterView />
  </main>

  <AppMenu class="fixed right-0 bottom-0 left-0 z-40" />
</template>
