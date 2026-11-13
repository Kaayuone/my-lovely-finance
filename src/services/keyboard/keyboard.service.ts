import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { readonly, ref } from 'vue';
import { registerNativeListeners } from '@/utils/nativeListeners';

// Written on <html>; FormDrawer reads it via var(--keyboard-height) to pad its scroll region
// above the IME. Capacitor 8 already lifts the WebView above the keyboard itself (SystemBars
// pads the WebView parent on Android 15+, the window resizes below that), so this variable must
// carry only the overlap the platform left behind. Otherwise the form pays for the keyboard
// twice and collapses to a single visible field.
const KEYBOARD_HEIGHT_VAR = '--keyboard-height';

// Switches and checkboxes are inputs as well, but nothing is typed into them and they carry no
// message of their own. A Select without `editable` and a SelectButton render no input at all.
const TEXT_FIELD_SELECTOR = 'input:not([type="checkbox"]):not([type="radio"]), textarea';
const CHOICE_FIELD_SELECTOR = '.p-select, .p-selectbutton';
const FIELD_SELECTOR = `${TEXT_FIELD_SELECTOR}, ${CHOICE_FIELD_SELECTOR}`;

// Layout viewport with the IME hidden; the width tells a rotation apart from an IME shrink.
let baselineWidth = 0;
let baselineHeight = 0;
// The plugin reports dp, which is a CSS px at width=device-width.
let imeHeight = 0;
let isImeVisible = false;

// The bottom nav collapses while the IME is up, see DefaultLayout.
const keyboardOpen = ref(false);
export const isKeyboardOpen = readonly(keyboardOpen);

function setKeyboardHeight(height: number) {
  document.documentElement.style.setProperty(KEYBOARD_HEIGHT_VAR, `${height}px`);
}

function updateBaseline() {
  if (window.innerWidth !== baselineWidth) {
    baselineWidth = window.innerWidth;
    baselineHeight = window.innerHeight;
    return;
  }
  // Never lower it: a shrink means the WebView is being lifted above the IME, and that layout
  // pass can land before the plugin reports the keyboard.
  if (window.innerHeight > baselineHeight) baselineHeight = window.innerHeight;
}

function applyNativeOverlap() {
  if (!isImeVisible) {
    setKeyboardHeight(0);
    return;
  }

  const platformOffset = baselineHeight - window.innerHeight;
  setKeyboardHeight(Math.min(Math.max(imeHeight - platformOffset, 0), imeHeight));
}

// Browsers keep the layout viewport and shrink the visual one instead (interactive-widget
// defaults to resizes-visual); `scale` undoes pinch zoom, which shrinks it with no keyboard.
function applyVisualViewportOverlap() {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const overlap = Math.max(Math.round(window.innerHeight - viewport.height * viewport.scale), 0);
  keyboardOpen.value = overlap > 0;
  setKeyboardHeight(overlap);
}

function holdsAnotherField(node: Element, field: HTMLElement, selector: string) {
  return Array.from(node.querySelectorAll(selector)).some(other => !other.contains(field));
}

// FieldError goes right after the field it belongs to, so a message is the field's when the closest
// field before it is this one; a hint or a switch between the two does not count
function holdsOwnMessage(node: Element, field: HTMLElement) {
  return Array.from(node.children).some(child => {
    if (!child.matches('[data-field-error]')) return false;

    let sibling = child.previousElementSibling;
    while (sibling && !sibling.matches(FIELD_SELECTOR) && !sibling.querySelector(FIELD_SELECTOR)) {
      sibling = sibling.previousElementSibling;
    }
    return Boolean(sibling?.contains(field));
  });
}

// The root of a field is its closest ancestor holding the field's own message. The climb stops
// before an ancestor with another field, so neither a neighbour's message nor one of the whole form
// sitting among the form's fields is reached. Choice fields are checked after the message, because
// a compound input can keep its own step SelectButton right under its message
function findFieldWithMessage(field: HTMLElement) {
  for (let node = field.parentElement; node && node !== document.body; node = node.parentElement) {
    if (holdsAnotherField(node, field, TEXT_FIELD_SELECTOR)) return null;
    if (holdsOwnMessage(node, field)) return node;
    if (holdsAnotherField(node, field, CHOICE_FIELD_SELECTOR)) return null;
  }
  return null;
}

function scrollFocusedFieldIntoView() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  const tag = active.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !active.isContentEditable) return;

  // Lining up the field alone parks its message right under it, behind the IME. A root taller than
  // the screen cannot be shown whole, and lining it up could push the field itself out of view
  const root = findFieldWithMessage(active);
  const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
  const target = root && root.getBoundingClientRect().height <= visibleHeight ? root : active;
  target.scrollIntoView({ block: 'nearest' });
}

function onWindowResize() {
  if (!isImeVisible) updateBaseline();
  applyNativeOverlap();
}

export async function registerKeyboardListeners() {
  if (!Capacitor.isNativePlatform()) {
    const viewport = window.visualViewport;
    if (!viewport) return () => {};

    viewport.addEventListener('resize', applyVisualViewportOverlap);

    return () => {
      viewport.removeEventListener('resize', applyVisualViewportOverlap);
      keyboardOpen.value = false;
      setKeyboardHeight(0);
    };
  }

  updateBaseline();

  const removeListeners = await registerNativeListeners([
    // Only records state: SystemBars applies its padding with the final insets at animation start,
    // so the resize handler settles the value within a frame. Writing here would flash a full
    // keyboard height that resize then takes away.
    () =>
      Keyboard.addListener('keyboardWillShow', info => {
        isImeVisible = true;
        keyboardOpen.value = true;
        imeHeight = info.keyboardHeight;
      }),
    () =>
      Keyboard.addListener('keyboardDidShow', info => {
        isImeVisible = true;
        keyboardOpen.value = true;
        imeHeight = info.keyboardHeight;
        applyNativeOverlap();
        scrollFocusedFieldIntoView();
      }),
    () =>
      Keyboard.addListener('keyboardWillHide', () => {
        isImeVisible = false;
        keyboardOpen.value = false;
        imeHeight = 0;
        setKeyboardHeight(0);
      }),
    () =>
      Keyboard.addListener('keyboardDidHide', () => {
        isImeVisible = false;
        keyboardOpen.value = false;
        imeHeight = 0;
        setKeyboardHeight(0);
        updateBaseline();
      }),
  ]);

  window.addEventListener('resize', onWindowResize);

  return () => {
    removeListeners();
    window.removeEventListener('resize', onWindowResize);
    isImeVisible = false;
    keyboardOpen.value = false;
    imeHeight = 0;
    setKeyboardHeight(0);
  };
}
