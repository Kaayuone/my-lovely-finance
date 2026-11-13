// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { check, object, pipe } from 'valibot';
import { nextTick, ref } from 'vue';
import { useFormValidation } from '../useFormValidation';
import { requiredText } from '../schemas';

const FORM_SCHEMA = pipe(
  object({ title: requiredText('Введите заголовок'), note: requiredText('Введите заметку') }),
  check(form => form.title !== form.note, 'Заголовок и заметка не могут совпадать'),
);

function createForm(title = '', note = 'Заметка') {
  return ref({ title, note });
}

describe('useFormValidation', () => {
  it('stays silent until the first save attempt', async () => {
    const form = createForm();
    const { errors } = useFormValidation(FORM_SCHEMA, form);

    form.value.note = '';
    await nextTick();

    expect(errors.value).toEqual({});
  });

  it('reports the invalid fields of a rejected save', () => {
    const form = createForm();
    const { errors, validate } = useFormValidation(FORM_SCHEMA, form);

    expect(validate()).toBe(false);
    expect(errors.value.title).toBe('Введите заголовок');
  });

  it('follows the fields once the errors are shown', async () => {
    const form = createForm();
    const { errors, validate } = useFormValidation(FORM_SCHEMA, form);
    validate();

    form.value.title = 'Покупки';
    await nextTick();

    expect(errors.value).toEqual({});
  });

  it('exposes a rule of the whole form separately from the fields', () => {
    const form = createForm('Покупки', 'Покупки');
    const { errors, formError, validate } = useFormValidation(FORM_SCHEMA, form);

    expect(validate()).toBe(false);
    expect(formError.value).toBe('Заголовок и заметка не могут совпадать');
    expect(errors.value.title).toBeUndefined();
  });

  it('goes quiet again after a reset, as a reopened dialog needs', async () => {
    const form = createForm();
    const { errors, validate, resetValidation } = useFormValidation(FORM_SCHEMA, form);
    validate();

    resetValidation();
    form.value.note = '';
    await nextTick();

    expect(errors.value).toEqual({});
  });

  it('re-reads a schema that depends on the dialog it belongs to', () => {
    const form = createForm('Покупки');
    let isStrict = false;
    const { validate } = useFormValidation(
      () => (isStrict ? FORM_SCHEMA : object({ title: requiredText() })),
      form,
    );

    expect(validate()).toBe(true);

    isStrict = true;
    form.value.note = '';

    expect(validate()).toBe(false);
  });
});
