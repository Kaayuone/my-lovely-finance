import { describe, expect, it } from 'vitest';
import { object } from 'valibot';
import { collectErrors } from '../formValidation';
import { requiredDate, requiredOption, requiredText } from '../schemas';

const REQUIRED_SCHEMAS = {
  requiredText: object({ field: requiredText('Заполните') }),
  requiredOption: object({ field: requiredOption('Заполните') }),
  requiredDate: object({ field: requiredDate('Заполните') }),
};

describe('required rules', () => {
  // A cleared PrimeVue field writes null; undefined only comes from a form built by hand
  it.each(Object.entries(REQUIRED_SCHEMAS))('%s rejects null and undefined', (_name, schema) => {
    expect(collectErrors(schema, { field: null })).toEqual({ field: 'Заполните' });
    expect(collectErrors(schema, { field: undefined })).toEqual({ field: 'Заполните' });
  });

  // Not a user error but a broken form object: it must fail loudly rather than pass as filled in
  it.each(Object.entries(REQUIRED_SCHEMAS))('%s rejects a missing key', (_name, schema) => {
    expect(collectErrors(schema, {})).toHaveProperty('field');
  });

  it('accepts a filled value', () => {
    expect(collectErrors(REQUIRED_SCHEMAS.requiredText, { field: 'Покупки' })).toEqual({});
    expect(collectErrors(REQUIRED_SCHEMAS.requiredOption, { field: 'card' })).toEqual({});
    expect(collectErrors(REQUIRED_SCHEMAS.requiredDate, { field: new Date() })).toEqual({});
  });

  it('rejects a blank string', () => {
    expect(collectErrors(REQUIRED_SCHEMAS.requiredText, { field: '   ' })).toEqual({
      field: 'Заполните',
    });
  });

  // A record saved with an empty date opens with an Invalid Date, and saving it again as is would
  // write `NaN-NaN-…`
  it('rejects an Invalid Date as an empty date', () => {
    expect(collectErrors(REQUIRED_SCHEMAS.requiredDate, { field: new Date(NaN) })).toEqual({
      field: 'Заполните',
    });
  });
});
