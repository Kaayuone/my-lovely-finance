import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createDeferred, flushMicrotasks } from '@/__tests__/deferred';
import type { PendingNotification } from '@/services/capture';

const capture = vi.hoisted(() => ({
  isCaptureSupported: vi.fn(),
  getPendingNotifications: vi.fn(),
  acknowledgeNotifications: vi.fn(),
}));

const draftRepository = vi.hoisted(() => ({
  insertDrafts: vi.fn(),
}));

vi.mock('@/services/capture', () => ({
  ...capture,
  PENDING_NOTIFICATIONS_BATCH_SIZE: 3,
}));
vi.mock('@/entities/draft/draft.repository', () => draftRepository);

import { useDraftStore } from '@/stores/draftStore';

function notification(id: number): PendingNotification {
  return {
    id,
    packageName: 'com.iskra.mobile',
    appLabel: 'БНБ',
    postedAt: 1794387600000 + id * 1000,
    capturedAt: 1794387600000 + id * 1000,
    origin: 'posted',
    title: 'Безналичная оплата',
    text: 'Успешно, *3333, -11.90 BYN, Остаток: 61.10 BYN, BOOSTY.TO',
    bigText: null,
    subText: null,
    lines: null,
    fingerprint: `fingerprint-${id}`,
  };
}

function batch(...ids: number[]): PendingNotification[] {
  return ids.map(notification);
}

// What the store asked the repository to insert, by fingerprint, one array per transaction
function insertedFingerprints(): string[][] {
  return draftRepository.insertDrafts.mock.calls.map(([drafts]) =>
    drafts.map((draft: { captureFingerprint: string }) => draft.captureFingerprint),
  );
}

beforeEach(() => {
  setActivePinia(createPinia());
  Object.values(capture).forEach(mock => mock.mockReset());
  Object.values(draftRepository).forEach(mock => mock.mockReset());
  capture.isCaptureSupported.mockReturnValue(true);
  capture.acknowledgeNotifications.mockResolvedValue(undefined);
  draftRepository.insertDrafts.mockImplementation(async drafts => drafts.length);
});

describe('draftStore.takeCaptureQueue', () => {
  it('never reaches the native plugin on the web', async () => {
    capture.isCaptureSupported.mockReturnValue(false);

    await useDraftStore().takeCaptureQueue();

    expect(capture.getPendingNotifications).not.toHaveBeenCalled();
    expect(draftRepository.insertDrafts).not.toHaveBeenCalled();
    expect(capture.acknowledgeNotifications).not.toHaveBeenCalled();
  });

  it('acknowledges a batch only after its drafts are committed, up to its greatest id', async () => {
    const commit = createDeferred<number>();
    capture.getPendingNotifications.mockResolvedValueOnce(batch(9, 5));
    draftRepository.insertDrafts.mockReturnValueOnce(commit.promise);

    const take = useDraftStore().takeCaptureQueue();
    await flushMicrotasks();

    expect(capture.getPendingNotifications).toHaveBeenCalledWith(3);
    expect(insertedFingerprints()).toEqual([['fingerprint-9', 'fingerprint-5']]);
    expect(capture.acknowledgeNotifications).not.toHaveBeenCalled();

    commit.resolve(2);
    await take;

    expect(capture.acknowledgeNotifications).toHaveBeenCalledExactlyOnceWith(9);
  });

  it('acknowledges nothing when the drafts fail to commit', async () => {
    capture.getPendingNotifications.mockResolvedValueOnce(batch(1, 2));
    draftRepository.insertDrafts.mockRejectedValueOnce(new Error('CHECK constraint failed'));

    await expect(useDraftStore().takeCaptureQueue()).rejects.toThrow('CHECK constraint failed');

    expect(capture.acknowledgeNotifications).not.toHaveBeenCalled();
  });

  it('takes batch after batch until one comes short', async () => {
    capture.getPendingNotifications
      .mockResolvedValueOnce(batch(1, 2, 3))
      .mockResolvedValueOnce(batch(4, 5, 6))
      .mockResolvedValueOnce(batch(7));

    await useDraftStore().takeCaptureQueue();

    expect(capture.getPendingNotifications).toHaveBeenCalledTimes(3);
    expect(insertedFingerprints()).toHaveLength(3);
    expect(capture.acknowledgeNotifications.mock.calls).toEqual([[3], [6], [7]]);
  });

  it('stops at an empty batch after a full one without writing anything', async () => {
    capture.getPendingNotifications.mockResolvedValueOnce(batch(1, 2, 3)).mockResolvedValueOnce([]);

    await useDraftStore().takeCaptureQueue();

    expect(capture.getPendingNotifications).toHaveBeenCalledTimes(2);
    expect(draftRepository.insertDrafts).toHaveBeenCalledTimes(1);
    expect(capture.acknowledgeNotifications).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('answers any number of requests during a take with exactly one more take', async () => {
    const firstRead = createDeferred<PendingNotification[]>();
    capture.getPendingNotifications
      .mockReturnValueOnce(firstRead.promise)
      .mockResolvedValueOnce(batch(4))
      .mockResolvedValue([]);
    const store = useDraftStore();

    const first = store.takeCaptureQueue();
    const requests = [store.takeCaptureQueue(), store.takeCaptureQueue(), store.takeCaptureQueue()];
    await flushMicrotasks();

    // The take in progress is still the only one
    expect(capture.getPendingNotifications).toHaveBeenCalledTimes(1);

    firstRead.resolve(batch(1));
    await Promise.all([first, ...requests]);

    expect(capture.getPendingNotifications).toHaveBeenCalledTimes(2);
    expect(insertedFingerprints()).toEqual([['fingerprint-1'], ['fingerprint-4']]);
    expect(capture.acknowledgeNotifications.mock.calls).toEqual([[1], [4]]);
  });

  it('starts afresh once a take is over', async () => {
    capture.getPendingNotifications.mockResolvedValue([]);
    const store = useDraftStore();

    await store.takeCaptureQueue();
    await store.takeCaptureQueue();

    expect(capture.getPendingNotifications).toHaveBeenCalledTimes(2);
  });
});
