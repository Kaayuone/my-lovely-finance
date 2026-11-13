<template>
  <!-- PrimeVue Dialog focuses the first [autofocus] element of the default slot and otherwise falls
       back to the close button with a forced focus ring. This invisible, non-tabbable target absorbs
       that focus, so nothing is highlighted when a dialog without an action button opens. -->
  <span class="outline-none" tabindex="-1" autofocus></span>
</template>
