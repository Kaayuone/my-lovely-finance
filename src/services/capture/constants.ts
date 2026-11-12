// How much of the capture queue the journal shows: enough to see a day of a few banks and the
// listener through a restart of the phone, small enough for a plain list
export const CAPTURE_JOURNAL_NOTIFICATIONS_LIMIT = 50;
export const CAPTURE_JOURNAL_EVENTS_LIMIT = 30;
export const CAPTURE_JOURNAL_SKIPPED_LIMIT = 30;

// How many notifications of the queue one transaction turns into drafts: the first start after an
// update takes up to 90 days of the queue, and a smaller batch keeps each transaction and each
// answer of the plugin short
export const PENDING_NOTIFICATIONS_BATCH_SIZE = 100;
