import { initializeDatabase, setDbInitFailed, setDbInitReady } from '@/database';

/**
 * Opens the database on the first start and again on «Повторить» of the error screen. Until the
 * status turns ready the app renders no screen, so no store reads a database that is not there.
 */
export async function startDatabase(): Promise<void> {
  try {
    await initializeDatabase();
  } catch {
    // initializeDatabase has logged the cause; the error screen offers the retry
    setDbInitFailed();
    return;
  }

  setDbInitReady();
}
