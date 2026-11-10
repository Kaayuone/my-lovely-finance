import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

async function openTab(page: Page, name: string, url: string): Promise<void> {
  await page.getByRole('tab', { name }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('opens on the inbox and switches between the pages of the bottom bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Входящие' })).toBeVisible();
  await expect(page.getByText('Черновиков пока нет')).toBeVisible();
  // A horizontal pan in a fixed-width WebView reads as broken: nothing may overflow the narrowest tier
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await openTab(page, 'Операции', '/operations');
  await openTab(page, 'Счета', '/accounts');
  await openTab(page, 'Настройки', '/settings');
  await openTab(page, 'Входящие', '/');
});

test('sends an unknown path to the inbox', async ({ page }) => {
  await page.goto('/no-such-page');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Входящие' })).toBeVisible();
});

test('starts dark and keeps the light theme after a reload', async ({ page }) => {
  await page.goto('/settings');
  const html = page.locator('html');
  await expect(html).toHaveClass(/dark-mode/);

  await page.getByLabel('Тёмная тема').click();
  await expect(html).not.toHaveClass(/dark-mode/);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
  await expect(html).not.toHaveClass(/dark-mode/);
  await expect(page.getByLabel('Тёмная тема')).not.toBeChecked();
});

test('opens push capture from the settings and comes back with the header button', async ({
  page,
}) => {
  await page.goto('/settings');

  await page.getByRole('link', { name: /Сбор пушей/ }).click();
  await expect(page).toHaveURL('/settings/capture');
  await expect(page.getByRole('heading', { level: 1, name: 'Сбор пушей' })).toBeVisible();
  // The web build has no notification listener to show
  await expect(page.getByText('Только на Android')).toBeVisible();
  // A nested page keeps the tab it belongs to
  await expect(page.getByRole('tab', { name: 'Настройки' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
});
