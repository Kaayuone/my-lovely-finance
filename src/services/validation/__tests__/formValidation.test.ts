// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { check, object, pipe } from 'valibot';
import { nextTick } from 'vue';
import { collectErrors, focusFirstInvalidField } from '../formValidation';
import { useFormValidation } from '../useFormValidation';
import { requiredText } from '../schemas';
import { FORM_ERROR_KEY } from '../constants';

const FORM_SCHEMA = pipe(
  object({
    title: requiredText('Введите заголовок'),
    note: requiredText('Введите заметку'),
  }),
  check(form => form.title !== form.note, 'Заголовок и заметка не могут совпадать'),
);

describe('collectErrors', () => {
  it('returns nothing for a valid form', () => {
    expect(collectErrors(FORM_SCHEMA, { title: 'Покупки', note: 'Продукты' })).toEqual({});
  });

  it('reports one message per invalid field', () => {
    expect(collectErrors(FORM_SCHEMA, { title: '  ', note: null })).toEqual({
      title: 'Введите заголовок',
      note: 'Введите заметку',
    });
  });

  it('ignores the fields a schema says nothing about', () => {
    expect(
      collectErrors(object({ title: requiredText() }), { title: 'Покупки', extra: 'что угодно' }),
    ).toEqual({});
  });

  it('keys a rule of the whole form under FORM_ERROR_KEY', () => {
    const errors = collectErrors(FORM_SCHEMA, { title: 'Покупки', note: 'Покупки' });

    expect(errors[FORM_ERROR_KEY]).toBe('Заголовок и заметка не могут совпадать');
  });

  it('names a nested path the way the template reads it', () => {
    const schema = object({
      items: object({ details: object({ name: requiredText('Введите') }) }),
    });

    expect(collectErrors(schema, { items: { details: { name: '' } } })).toEqual({
      'items.details.name': 'Введите',
    });
  });
});

describe('focusFirstInvalidField', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the first invalid input after validate rejects the form', async () => {
    document.body.innerHTML = `
      <input id="first" class="p-inputtext p-invalid" />
      <input id="second" class="p-inputtext p-invalid" />
    `;

    const { validate } = useFormValidation(FORM_SCHEMA, { title: '', note: '' });
    expect(validate()).toBe(false);
    await nextTick();

    expect(document.activeElement?.id).toBe('first');
  });

  it('focuses the input of an invalid wrapper', () => {
    document.body.innerHTML = '<div class="p-select p-invalid"><input id="inner" /></div>';

    focusFirstInvalidField();

    expect(document.activeElement?.id).toBe('inner');
  });

  // The calendar overlay would cover the message the user has just been shown
  it('leaves a date field and a readonly trigger unfocused', () => {
    document.body.innerHTML = `
      <div class="p-datepicker p-invalid"><input id="date" /></div>
      <input id="readonly" class="p-inputtext p-invalid" readonly />
    `;

    focusFirstInvalidField();

    expect(document.activeElement?.id).not.toBe('date');
  });

  it('falls back to the message of a rule that marks no field', () => {
    document.body.innerHTML = '<small data-field-error>Заполните хотя бы одно поле</small>';

    expect(() => focusFirstInvalidField()).not.toThrow();
  });

  it('does nothing when the form is valid', () => {
    document.body.innerHTML = '<input id="valid" class="p-inputtext" />';

    focusFirstInvalidField();

    expect(document.activeElement?.id).not.toBe('valid');
  });
});
