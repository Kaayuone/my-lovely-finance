import { expect, test } from '@playwright/test';

import { accountRow, addAccount, longPress } from './helpers';

import type { Locator, Page } from '@playwright/test';

const NAME = 'Карта Альфа';

function archiveSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Архив' });
}

function rowActions(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name, exact: true });
}

test('adds a card with its digits and balance and keeps it after a reload', async ({ page }) => {
  await page.goto('/');
  await addAccount(page, {
    name: NAME,
    type: 'card',
    currency: 'BYN',
    openingBalance: '1 234,56',
    cardDigits: ['1234'],
  });

  const row = accountRow(page, NAME);
  await expect(row.getByText('·1234', { exact: true })).toBeVisible();
  await expect(row).toContainText(/1\s234,56\sBYN/);

  await page.reload();
  await expect(row.getByText('·1234', { exact: true })).toBeVisible();
  await expect(row).toContainText(/1\s234,56\sBYN/);
});

test('shows the balance of every account in its own currency', async ({ page }) => {
  await page.goto('/');
  await addAccount(page, { name: NAME, type: 'card', currency: 'BYN', openingBalance: '10' });
  await addAccount(page, {
    name: 'Доллары дома',
    type: 'cash',
    currency: 'USD',
    openingBalance: '-50,5',
  });

  await expect(accountRow(page, NAME)).toContainText(/10,00\sBYN/);
  await expect(accountRow(page, 'Доллары дома')).toContainText(/-50,50\s\$/);
});

test('renames an account and does not save it without a name', async ({ page }) => {
  await page.goto('/');
  await addAccount(page, { name: NAME, type: 'card', currency: 'BYN' });

  await accountRow(page, NAME).click();
  const form = page.getByRole('dialog', { name: 'Счёт', exact: true });
  const name = form.getByLabel('Название*');
  await expect(name).toHaveValue(NAME);
  // The operations of a saved account are in its currency, so neither the type nor it changes
  await expect(form.getByRole('button', { name: 'Карта', exact: true })).toBeDisabled();
  await expect(form.getByLabel('Валюта*')).toBeDisabled();

  await name.fill('');
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form.getByText('Введите название счёта')).toBeVisible();

  await name.fill('Карта Бета');
  await expect(form.getByText('Введите название счёта')).toHaveCount(0);
  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();

  await expect(form).toHaveCount(0);
  await expect(accountRow(page, 'Карта Бета')).toBeVisible();
  await expect(accountRow(page, NAME)).toHaveCount(0);
});

test('keeps a long name and a large balance within 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const name = 'Зарплатная карта для коммунальных платежей, продуктов и поездок';
  await page.goto('/');
  await addAccount(page, {
    name,
    type: 'card',
    currency: 'BYN',
    openingBalance: '-12 345 678,90',
    cardDigits: ['1234', '5678'],
  });

  const balance = accountRow(page, name).getByText(/12\s345\s678,90/);
  await expect(balance).toBeVisible();

  // A horizontal pan in a fixed-width WebView reads as broken: nothing may overflow the narrowest tier
  expect(
    await page.evaluate(() => {
      const main = document.querySelector('main');
      return (
        document.documentElement.scrollWidth <= window.innerWidth &&
        main !== null &&
        main.scrollWidth <= main.clientWidth
      );
    }),
  ).toBe(true);
  const box = (await balance.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  // The name gives way, the balance stays on one line
  expect(
    await balance.evaluate(
      element => element.clientHeight < parseFloat(getComputedStyle(element).lineHeight) * 1.5,
    ),
  ).toBe(true);
});

test.describe('held row', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('moves an account to the archive and back', async ({ page }) => {
    await page.goto('/');
    await addAccount(page, { name: NAME, type: 'card', currency: 'BYN' });

    await longPress(page, accountRow(page, NAME));
    const sheet = rowActions(page, NAME);
    await sheet.getByRole('button', { name: 'В архив', exact: true }).tap();
    await expect(sheet).toHaveCount(0);
    await expect(archiveSection(page).getByText(NAME, { exact: true })).toBeVisible();

    await longPress(page, accountRow(page, NAME));
    await sheet.getByRole('button', { name: 'Вернуть', exact: true }).tap();
    await expect(sheet).toHaveCount(0);
    await expect(archiveSection(page)).toHaveCount(0);
    await expect(accountRow(page, NAME)).toBeVisible();
  });

  test('deletes an account without operations after the confirmation', async ({ page }) => {
    await page.goto('/');
    await addAccount(page, { name: NAME, type: 'card', currency: 'BYN' });

    await longPress(page, accountRow(page, NAME));
    await rowActions(page, NAME).getByRole('button', { name: 'Удалить', exact: true }).tap();

    const confirmation = page.getByRole('dialog', { name: 'Удалить счёт?' });
    await expect(confirmation.getByText(`Счёт «${NAME}» будет удалён.`)).toBeVisible();
    await confirmation.getByRole('button', { name: 'Удалить', exact: true }).tap();

    await expect(confirmation).toHaveCount(0);
    await expect(accountRow(page, NAME)).toHaveCount(0);
    await expect(page.getByText('Счетов пока нет')).toBeVisible();
  });
});
