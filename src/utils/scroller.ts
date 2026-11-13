import { nextTick, toRaw } from 'vue';

import type { ShallowRef, ShallowUnwrapRef } from 'vue';
import type { DynamicScrollerExposed } from 'vue-virtual-scroller';

// `DynamicScroller` exposes no scroll getter, but its root element is the scrolling box
// (`.vue-recycle-scroller` carries `overflow-y: auto`), so `$el` is read directly.
// Pass to `useTemplateRef`: `useTemplateRef<ScrollerHandle<Item>>('scrollerRef')`.
export type ScrollerHandle<T> = ShallowUnwrapRef<DynamicScrollerExposed<T>> & { $el: HTMLElement };

export type ScrollerRef<T> = Readonly<ShallowRef<ScrollerHandle<T> | null>>;

/**
 * A short stable version of a row's data for its scroller key. `DynamicScroller` caches the size of
 * an item by its `id` and measures it only when its own view changes size: a row that grew or shrank
 * while scrolled away and comes back in a recycled view of its new height keeps the stale size and
 * overlaps its neighbour. With the version in the key the changed row is a new item, measured anew.
 * FNV-1a over the JSON; the array keeps an `undefined` value a string. Serialized raw: read through
 * the store's proxies, every field of every row would become a dependency of the list's computed.
 */
export function itemVersion(value: unknown): string {
  const text = JSON.stringify([value], (_key, nested: unknown) => toRaw(nested));
  // 32-bit FNV offset basis and prime
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

/**
 * Reload a virtualized list and keep the user pinned to the top — but only when they were
 * already there, so reading further down the list is never interrupted. A newly added item
 * usually lands at the top, and without this the scroller keeps the previous offset.
 */
export async function reloadPinningTop<T>(scroller: ScrollerRef<T>, reload: () => Promise<void>) {
  // Read before reloading: the dialog is already closed, the list is not re-rendered yet
  const wasAtTop = scroller.value?.$el.scrollTop === 0;

  await reload();
  if (!wasAtTop) return;

  await nextTick();
  scroller.value?.scrollToPosition(0);
}
