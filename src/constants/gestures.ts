export const POINTER_DRAG_START_SHIFT_PX = 6;
export const SWIPE_COMMIT_SHIFT_PX = 50;
export const LONG_PRESS_DELAY_MS = 500;
// How long after its release a fired long press keeps swallowing the clicks the release causes
export const LONG_PRESS_RELEASE_GUARD_MS = 300;

// Marks an element `usePointerDrag` listens on, so nested surfaces can tell whose press it is
export const POINTER_DRAG_SURFACE_ATTRIBUTE = 'data-pointer-drag-surface';
