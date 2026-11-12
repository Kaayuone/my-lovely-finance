import { defineStore } from 'pinia';

import * as draftRepository from '@/entities/draft/draft.repository';
import {
  PENDING_NOTIFICATIONS_BATCH_SIZE,
  acknowledgeNotifications,
  getPendingNotifications,
  isCaptureSupported,
} from '@/services/capture';
import { notificationToDraft } from './notificationToDraft';

// Drafts of operations made from captured notifications. For now only the move of the capture queue
// into them; the inbox that shows them comes later
export const useDraftStore = defineStore('draft', () => {
  let currentTake: Promise<void> | null = null;
  let isTakeRequested = false;

  /**
   * Moves the capture queue into drafts (ADR-0003). Takes never overlap: a request during one makes
   * one more after it, however many came — the notification behind them may have reached the queue
   * after the batch was read. Resolves when that one is over too. A no-op on the web, which has no
   * queue.
   */
  async function takeCaptureQueue(): Promise<void> {
    if (!isCaptureSupported()) return;
    if (currentTake) {
      isTakeRequested = true;
      return currentTake;
    }

    currentTake = (async () => {
      try {
        do {
          isTakeRequested = false;
          await takeAllBatches();
        } while (isTakeRequested);
      } finally {
        currentTake = null;
      }
    })();
    return currentTake;
  }

  // A batch is acknowledged only after its drafts are committed. A process that dies in between
  // leaves the batch in the queue, the next take reads it again, and the fingerprint of each draft
  // drops the repeats
  async function takeAllBatches(): Promise<void> {
    for (;;) {
      const notifications = await getPendingNotifications(PENDING_NOTIFICATIONS_BATCH_SIZE);
      if (notifications.length === 0) return;

      await draftRepository.insertDrafts(notifications.map(notificationToDraft));
      await acknowledgeNotifications(Math.max(...notifications.map(({ id }) => id)));

      if (notifications.length < PENDING_NOTIFICATIONS_BATCH_SIZE) return;
    }
  }

  return { takeCaptureQueue };
});
