import { collectErrors, focusFirstInvalidField } from './formValidation';

import { computed, nextTick, ref, toValue, watch } from 'vue';

import type { GenericSchema } from 'valibot';
import type { MaybeRefOrGetter } from 'vue';
import type { FormErrors } from './validation.types';

import { FORM_ERROR_KEY } from './constants';

/**
 * Field errors of one form. They appear on the first save attempt and follow the fields from then
 * on, so a field being fixed stops being red as soon as it becomes valid — showing them on blur
 * instead would paint a form red while the user is still filling it in on a phone.
 */
export function useFormValidation(
  schema: MaybeRefOrGetter<GenericSchema>,
  source: MaybeRefOrGetter<unknown>,
) {
  const errors = ref<FormErrors>({});
  const isSubmitted = ref(false);

  const formError = computed(() => errors.value[FORM_ERROR_KEY]);

  watch(
    () => toValue(source),
    () => {
      if (!isSubmitted.value) return;

      errors.value = collectErrors(toValue(schema), toValue(source));
    },
    { deep: true },
  );

  async function focusAfterRender() {
    await nextTick();
    focusFirstInvalidField();
  }

  function validate() {
    isSubmitted.value = true;
    errors.value = collectErrors(toValue(schema), toValue(source));

    const isValid = Object.keys(errors.value).length === 0;
    if (!isValid) void focusAfterRender();

    return isValid;
  }

  function resetValidation() {
    isSubmitted.value = false;
    errors.value = {};
  }

  return { errors, formError, validate, resetValidation };
}
