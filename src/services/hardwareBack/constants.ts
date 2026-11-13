// The list of a select or the calendar of a date field: it opens on top of whatever hosts the
// field, so it closes before that dialog or drawer does
export const HARDWARE_BACK_PRIORITY_OVERLAY = 350;
// A confirmation closes before the form or picker that requested it
export const HARDWARE_BACK_PRIORITY_CONFIRM_DIALOG = 300;
// Any dialog opened on top of a form drawer (time picker, category picker): it closes before
// the drawer underneath it does
export const HARDWARE_BACK_PRIORITY_DRAWER_DIALOG = 250;
// A form drawer closes before the row actions sheet beneath it
export const HARDWARE_BACK_PRIORITY_FORM_DRAWER = 200;
// The sheet of a held row closes before the page handles the back gesture
export const HARDWARE_BACK_PRIORITY_ROW_ACTIONS = 170;

// The overlays PrimeVue portals into body. An inline calendar is part of the page, and an overlay
// playing its leave transition has already closed.
export const OPEN_OVERLAY_SELECTOR = [
  '.p-select-overlay:not(.p-anchored-overlay-leave-active)',
  '.p-datepicker-panel:not(.p-datepicker-panel-inline):not(.p-anchored-overlay-leave-active)',
].join(', ');
export const OVERLAY_FIELD_SELECTOR = '.p-select, .p-datepicker';
