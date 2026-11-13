import { check, forward, object, pipe, string } from 'valibot';
import { requiredDate, requiredOption } from '@/services/validation';
import {
  optionalPositiveAmount,
  requiredPositiveAmount,
} from '@/services/validation/amountSchemas';
import { accountCurrency, needsCreditAmount } from './utils';

import type { GenericSchema } from 'valibot';
import type { OperationForm, OperationFormContext } from './types';

// Every amount is read in the currency of its own account: the credited amount in the target
// account's, the fee in the source account's
export function getOperationFormSchema(
  form: OperationForm,
  context: OperationFormContext,
): GenericSchema {
  const currency = accountCurrency(form.accountId, context.accountsById);
  const commonEntries = {
    accountId: requiredOption<number>('Выберите счёт'),
    amountText: requiredPositiveAmount(currency, {
      empty: 'Введите сумму',
      invalid: 'Проверьте сумму',
    }),
    dateTime: requiredDate('Укажите дату'),
  };

  // A manually entered expense or income always names its category
  if (form.kind !== 'transfer') {
    return object({ ...commonEntries, categoryId: requiredOption<number>('Выберите категорию') });
  }

  const toCurrency = accountCurrency(form.toAccountId, context.accountsById);
  return pipe(
    object({
      ...commonEntries,
      toAccountId: requiredOption<number>('Выберите счёт зачисления'),
      // A hidden credited amount is not read, so any text passes
      toAmountText: needsCreditAmount(form, context)
        ? requiredPositiveAmount(toCurrency, {
            empty: 'Введите сумму зачисления',
            invalid: 'Проверьте сумму зачисления',
          })
        : string(),
      feeText: optionalPositiveAmount(currency, 'Проверьте комиссию'),
    }),
    forward(
      check(
        value => value.toAccountId === null || value.toAccountId !== value.accountId,
        'Выберите другой счёт',
      ),
      ['toAccountId'],
    ),
  );
}
