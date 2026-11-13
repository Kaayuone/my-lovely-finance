import { check, custom, instance, minLength, nullable, pipe, string, trim } from 'valibot';

import { REQUIRED_DATE_MESSAGE, REQUIRED_OPTION_MESSAGE, REQUIRED_TEXT_MESSAGE } from './constants';

export function requiredText(message: string = REQUIRED_TEXT_MESSAGE) {
  return pipe(string(message), trim(), minLength(1, message));
}

// A value that can only come from a fixed option list: the option list is the contract, so there
// is nothing left to check at runtime — the schema is here to carry the type into cross-field rules
export function optionValue<T>() {
  return custom<T>(() => true);
}

// `optionValue` lets anything through, so the check is the only place an empty value is caught —
// unlike the rules above, it has to name `undefined` itself
export function requiredOption<T>(message: string = REQUIRED_OPTION_MESSAGE) {
  return pipe(
    nullable(optionValue<T>()),
    check(value => value !== null && value !== undefined, message),
  );
}

// An Invalid Date is what an empty stored date parses into; it is no more a date than `null` and
// would be written back as `NaN-NaN-…`
export function requiredDate(message: string = REQUIRED_DATE_MESSAGE) {
  return pipe(
    nullable(instance(Date, message)),
    check(value => value !== null && !Number.isNaN(value.getTime()), message),
  );
}
