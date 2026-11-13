import { flatten, safeParse } from 'valibot';

import type { GenericSchema } from 'valibot';
import type { FormErrors } from './validation.types';

import { FORM_ERROR_KEY } from './constants';

/**
 * Runs a schema over a form value and returns the first message of every invalid field. A schema
 * describes only the fields it validates — valibot ignores the rest of the form object.
 */
export function collectErrors(schema: GenericSchema, value: unknown): FormErrors {
  const result = safeParse(schema, value);
  if (result.success) return {};

  const flat = flatten(result.issues);
  const errors: FormErrors = {};

  if (flat.root) errors[FORM_ERROR_KEY] = flat.root[0];
  for (const [path, messages] of Object.entries(flat.nested ?? {})) {
    if (messages?.[0]) errors[path] = messages[0];
  }

  return errors;
}

/**
 * Brings the first invalid field into view. The app never shows two forms at once — a drawer is
 * modal — so the first `.p-invalid` in the document belongs to the form the user has just tried
 * to save.
 */
export function focusFirstInvalidField() {
  // A rule that belongs to the whole form marks no field, so its message is the fallback target
  const field =
    document.querySelector<HTMLElement>('.p-invalid') ??
    document.querySelector<HTMLElement>('[data-field-error]');
  if (!field) return;

  field.scrollIntoView?.({ behavior: 'smooth', block: 'center' });

  // PrimeVue marks the input itself (InputText) or the wrapper (Select, DatePicker)
  const input =
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field
      : field.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');

  // The keyboard only helps where the user types: focusing a date field opens the calendar over
  // the message instead, and a readonly trigger has nothing to type into
  if (!input || input.readOnly || input.closest('.p-datepicker')) return;

  input.focus({ preventScroll: true });
}
