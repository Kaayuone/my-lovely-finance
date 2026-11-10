import { ref } from 'vue';

// This application-facing database module intentionally owns reactive startup state: App needs it
// before Pinia and app.mount are available. Keep the rest of the database layer Vue-independent.
export const dbInitStatus = ref<'pending' | 'ready' | 'failed'>('pending');

export function setDbInitReady() {
  dbInitStatus.value = 'ready';
}

export function setDbInitFailed() {
  dbInitStatus.value = 'failed';
}
