import { OPEN_OVERLAY_SELECTOR, OVERLAY_FIELD_SELECTOR } from './constants';

export function isOverlayOpen() {
  return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

// PrimeVue closes its overlays on Escape, a key the Android WebView never receives, so back sends
// it to the open overlay. A click outside would close the overlay as well, but the drawer under it
// would take that click for its own outside click and close too.
// Two overlays are not open at once in practice: the tap on a second field is an outside click
// that closes the first, and an overlay playing its leave transition does not count as open. Were
// two open, the one last in the DOM would close. That is not necessarily the one opened last: the
// portal takes its place in body when the field mounts, not when the overlay opens.
export function closeTopOverlay() {
  const overlay = Array.from(document.querySelectorAll(OPEN_OVERLAY_SELECTOR)).at(-1);
  if (!overlay) return;

  closeOverlay(overlay);
}

export function closeFieldOverlay(field: Element | null | undefined) {
  if (!field) return;

  const overlayId = field.getAttribute('aria-controls');
  if (!overlayId) return;

  const overlay = document.getElementById(overlayId)?.closest(OPEN_OVERLAY_SELECTOR);
  if (!overlay) return;

  // PrimeVue focuses the date input on Escape; focus it first without scrolling its container.
  if (field instanceof HTMLInputElement && document.activeElement !== field) {
    field.focus({ preventScroll: true });
  }

  closeOverlay(overlay, field.closest(OVERLAY_FIELD_SELECTOR) ?? field);
}

function closeOverlay(overlay: Element, field = findOverlayField(overlay)) {
  overlay.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
  );

  // The calendar hands focus back to its text input on Escape, and the input raises the keyboard
  const focused = document.activeElement;
  if (field && focused instanceof HTMLElement && field.contains(focused)) focused.blur();
}

// A field names its overlay in aria-controls: the date input names the calendar panel, the select
// names the list inside its overlay
function findOverlayField(overlay: Element) {
  const ids = new Set(
    [overlay, ...Array.from(overlay.querySelectorAll('[id]'))]
      .map(element => element.id)
      .filter(id => id),
  );
  const control = Array.from(document.querySelectorAll('[aria-controls]')).find(element =>
    ids.has(element.getAttribute('aria-controls') ?? ''),
  );

  return control?.closest(OVERLAY_FIELD_SELECTOR) ?? control ?? null;
}
