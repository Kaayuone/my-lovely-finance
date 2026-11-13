import { expect, test } from '@playwright/test';

import { accountRow, addAccount, longPress } from './helpers';

import type { Locator, Page } from '@playwright/test';

type OperationOptions = {
  // An expense unless set
  income?: boolean;
  amount: string;
  // The way through the picker: the main category, then its subcategory if it has any
  category?: string[];
  payee?: string;
};

const CARD = 'Карта';
const WALLET = 'Кошелёк';
const GROCERIES = ['Еда и напитки', 'Продукты'];
// Intl writes the minus as U+2212 or as a hyphen, depending on the ICU version
const MINUS = '[-−]';

async function addAccounts(page: Page): Promise<void> {
  await page.goto('/');
  await addAccount(page, { name: CARD, type: 'card', currency: 'BYN', openingBalance: '100' });
  await addAccount(page, { name: WALLET, type: 'cash', currency: 'USD' });
}

async function openOperations(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Операции' }).click();
  await expect(page).toHaveURL('/operations');
}

async function openAccounts(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Счета' }).click();
  await expect(page).toHaveURL('/accounts');
}

function operationForm(page: Page, header = 'Новая операция'): Locator {
  return page.getByRole('dialog', { name: header, exact: true });
}

// The scroller keeps the spare views of its pool hidden with the text of their last row: the role
// leaves them out, so only a row on screen is found
function operationRow(page: Page, title: string): Locator {
  return page
    .getByRole('main')
    .getByRole('button')
    .filter({ has: page.getByText(title, { exact: true }) });
}

async function pickCategory(page: Page, form: Locator, path: string[]): Promise<void> {
  await form.getByRole('button', { name: /^Категория\*/ }).click();
  for (const name of path) await page.getByRole('button', { name, exact: true }).click();

  await expect(form.getByText(path.join(' › '), { exact: true })).toBeVisible();
}

/** Adds an expense or an income through the floating button or the empty state. */
async function addOperation(page: Page, options: OperationOptions): Promise<void> {
  const { income = false, amount, category, payee } = options;

  // The empty feed offers the button itself, a feed with operations the floating one: never both
  await page.getByRole('button', { name: 'Добавить операцию', exact: true }).click();
  const form = operationForm(page);
  await expect(form).toBeVisible();

  if (income) await form.getByRole('button', { name: 'Доход', exact: true }).click();
  await form.getByLabel('Сумма*').fill(amount);
  if (category) await pickCategory(page, form, category);
  if (payee !== undefined) await form.getByLabel('Получатель').fill(payee);

  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form).toHaveCount(0);
}

test('adds an expense to the feed, takes it off the balance and keeps it after a reload', async ({
  page,
}) => {
  await addAccounts(page);
  await openOperations(page);
  await expect(page.getByText('Операций пока нет')).toBeVisible();

  await addOperation(page, { amount: '12,34', category: GROCERIES });

  const row = operationRow(page, 'Продукты');
  await expect(row).toContainText(new RegExp(`${MINUS}\\s?12,34\\sBYN`));
  await expect(row.getByText(CARD, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Сегодня' })).toBeVisible();

  await openAccounts(page);
  await expect(accountRow(page, CARD)).toContainText(/87,66/);

  await openOperations(page);
  await page.reload();
  await expect(row).toContainText(new RegExp(`${MINUS}\\s?12,34\\sBYN`));
});

test('sends to the accounts while there is no account to record on', async ({ page }) => {
  await page.goto('/operations');

  await expect(page.getByText('Сначала добавьте счёт')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить операцию' })).toHaveCount(0);

  await page.getByRole('button', { name: 'К счетам', exact: true }).click();
  await expect(page).toHaveURL('/accounts');
});

test('shows an income with a plus and a transfer between currencies with both amounts', async ({
  page,
}) => {
  await addAccounts(page);
  await openOperations(page);

  await addOperation(page, { income: true, amount: '500', category: ['Зарплата'] });
  await expect(operationRow(page, 'Зарплата')).toContainText(/\+500,00\sBYN/);

  // The credited amount is asked for only between currencies, in the currency of the target
  await page.getByRole('button', { name: 'Добавить операцию', exact: true }).click();
  const form = operationForm(page);
  await form.getByRole('button', { name: 'Перевод', exact: true }).click();
  await form.getByLabel('Сумма*').fill('10');
  await expect(form.getByLabel('Зачислено*')).toHaveCount(0);
  await form.locator('#operation_to_account').click();
  await page.getByRole('option', { name: `${WALLET} · USD`, exact: true }).click();
  await form.getByLabel('Зачислено*').fill('3');
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form).toHaveCount(0);

  const transfer = operationRow(page, 'Перевод');
  await expect(transfer.getByText(`${CARD} → ${WALLET}`, { exact: true })).toBeVisible();
  await expect(transfer).toContainText(new RegExp(`${MINUS}\\s?10,00\\sBYN`));
  await expect(transfer).toContainText(/\+3,00\s\$/);

  await openAccounts(page);
  await expect(accountRow(page, CARD)).toContainText(/590,00\sBYN/);
  await expect(accountRow(page, WALLET)).toContainText(/3,00\s\$/);
});

test('does not save an expense without an amount and a category', async ({ page }) => {
  await addAccounts(page);
  await openOperations(page);

  await page.getByRole('button', { name: 'Добавить операцию', exact: true }).click();
  const form = operationForm(page);
  // The empty picker reads the same words as its error
  const chooseCategory = form.getByText('Выберите категорию', { exact: true });
  await expect(chooseCategory).toHaveCount(1);

  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();

  await expect(form.getByText('Введите сумму', { exact: true })).toBeVisible();
  await expect(chooseCategory).toHaveCount(2);
  await expect(form).toBeVisible();
});

test('changes the amount of an operation', async ({ page }) => {
  await addAccounts(page);
  await openOperations(page);
  await addOperation(page, { amount: '12,34', category: GROCERIES });

  await operationRow(page, 'Продукты').click();
  const form = operationForm(page, 'Операция');
  const amount = form.getByLabel('Сумма*');
  await expect(amount).toHaveValue('12,34');
  await amount.fill('20');
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form).toHaveCount(0);

  const row = operationRow(page, 'Продукты');
  await expect(row).toContainText(new RegExp(`${MINUS}\\s?20,00\\sBYN`));
  await expect(row).not.toContainText('12,34');

  await openAccounts(page);
  await expect(accountRow(page, CARD)).toContainText(/80,00/);
});

test('deletes an operation from its form after the confirmation', async ({ page }) => {
  await addAccounts(page);
  await openOperations(page);
  await addOperation(page, { amount: '12,34', category: GROCERIES });

  await operationRow(page, 'Продукты').click();
  const form = operationForm(page, 'Операция');
  await form.getByRole('button', { name: 'Удалить', exact: true }).click();

  const confirmation = page.getByRole('dialog', { name: 'Удалить операцию?' });
  await expect(confirmation.getByText('Операция пропадёт из истории и остатков.')).toBeVisible();
  await confirmation.getByRole('button', { name: 'Удалить', exact: true }).click();

  await expect(confirmation).toHaveCount(0);
  await expect(form).toHaveCount(0);
  await expect(operationRow(page, 'Продукты')).toHaveCount(0);
  await expect(page.getByText('Операций пока нет')).toBeVisible();
});

test('keeps a long row within 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const name = 'Зарплатная карта для коммунальных платежей, продуктов и поездок';
  await page.goto('/');
  await addAccount(page, { name, type: 'card', currency: 'BYN' });
  await openOperations(page);
  await addOperation(page, {
    amount: '12 345 678,90',
    category: GROCERIES,
    payee: 'Гипермаркет «Евроопт» на проспекте Победителей, касса самообслуживания',
  });

  const amount = operationRow(page, 'Продукты').getByText(/12\s345\s678,90/);
  await expect(amount).toBeVisible();

  // A horizontal pan in a fixed-width WebView reads as broken: neither the page, nor the layout,
  // nor the scroller of the feed may overflow the narrowest tier
  expect(
    await page.evaluate(() =>
      [document.documentElement, ...document.querySelectorAll('main, .vue-recycle-scroller')].every(
        element => element.scrollWidth <= element.clientWidth,
      ),
    ),
  ).toBe(true);
  const box = (await amount.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});

test.describe('held row', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('deletes an operation held in the feed after the confirmation', async ({ page }) => {
    await addAccounts(page);
    await openOperations(page);
    await addOperation(page, { amount: '12,34', category: GROCERIES });

    await longPress(page, operationRow(page, 'Продукты'));
    const sheet = page.getByRole('dialog', { name: /^Продукты/ });
    await sheet.getByRole('button', { name: 'Удалить', exact: true }).tap();

    const confirmation = page.getByRole('dialog', { name: 'Удалить операцию?' });
    await expect(confirmation.getByText('Операция пропадёт из истории и остатков.')).toBeVisible();
    await confirmation.getByRole('button', { name: 'Удалить', exact: true }).tap();

    await expect(confirmation).toHaveCount(0);
    await expect(operationRow(page, 'Продукты')).toHaveCount(0);
    await expect(page.getByText('Операций пока нет')).toBeVisible();
  });

  test('offers the archive for an account with operations instead of deleting it', async ({
    page,
  }) => {
    await addAccounts(page);
    await openOperations(page);
    await addOperation(page, { amount: '12,34', category: GROCERIES });
    await openAccounts(page);

    await longPress(page, accountRow(page, CARD));
    await page
      .getByRole('dialog', { name: CARD, exact: true })
      .getByRole('button', { name: 'Удалить', exact: true })
      .tap();

    const refusal = page.getByRole('dialog', { name: 'Удалить нельзя' });
    await expect(refusal.getByText(/Его можно убрать в архив/)).toBeVisible();
    await refusal.getByRole('button', { name: 'В архив', exact: true }).tap();

    await expect(refusal).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Архив' }).getByText(CARD, { exact: true }),
    ).toBeVisible();
  });
});
