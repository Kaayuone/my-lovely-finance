import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerNativeListeners } from '@/utils/nativeListeners';

import type { PluginListenerHandle } from '@capacitor/core';

function createHandle(): PluginListenerHandle & { remove: ReturnType<typeof vi.fn> } {
  return { remove: vi.fn().mockResolvedValue(undefined) };
}

describe('registerNativeListeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers in order and removes every handle through one disposer', async () => {
    const first = createHandle();
    const second = createHandle();

    const remove = await registerNativeListeners([
      () => Promise.resolve(first),
      () => Promise.resolve(second),
    ]);
    remove();

    expect(first.remove).toHaveBeenCalledTimes(1);
    expect(second.remove).toHaveBeenCalledTimes(1);
  });

  it('removes the handles created so far when a later registration rejects', async () => {
    const first = createHandle();
    const second = createHandle();
    const third = vi.fn();

    await expect(
      registerNativeListeners([
        () => Promise.resolve(first),
        () => Promise.resolve(second),
        () => Promise.reject(new Error('listener registration failed')),
        () => Promise.resolve(third as never),
      ]),
    ).rejects.toThrow('listener registration failed');

    expect(first.remove).toHaveBeenCalledTimes(1);
    expect(second.remove).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
  });

  it('logs a failed removal instead of rejecting the disposer', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('remove failed');
    const handle = createHandle();
    handle.remove.mockRejectedValue(error);

    const remove = await registerNativeListeners([() => Promise.resolve(handle)]);

    expect(() => remove()).not.toThrow();
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to remove a native listener', error),
    );
    consoleError.mockRestore();
  });
});
