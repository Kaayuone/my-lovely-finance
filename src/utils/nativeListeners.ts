import type { PluginListenerHandle } from '@capacitor/core';

function removeHandles(handles: ReadonlyArray<PluginListenerHandle>) {
  for (const handle of handles) {
    handle.remove().catch(error => {
      console.error('Failed to remove a native listener', error);
    });
  }
}

/**
 * Registers native listeners in order and hands back a single disposer for all of them.
 * A rejection midway removes the handles created so far: otherwise the app keeps listeners it can
 * no longer detach, and a bootstrap retry registers a second copy of every one of them.
 */
export async function registerNativeListeners(
  registrars: ReadonlyArray<() => Promise<PluginListenerHandle>>,
): Promise<() => void> {
  const handles: PluginListenerHandle[] = [];

  try {
    for (const register of registrars) {
      handles.push(await register());
    }
  } catch (error) {
    removeHandles(handles);
    throw error;
  }

  return () => removeHandles(handles);
}
