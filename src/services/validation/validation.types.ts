// Errors of one form keyed by valibot dot path: 'title', 'items.0.name'.
// A rule that belongs to the whole form is stored under FORM_ERROR_KEY.
export type FormErrors = { [path: string]: string | undefined };
