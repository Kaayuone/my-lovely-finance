import { expect } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';

type Point = { x: number; y: number };

type AccountOptions = {
  name: string;
  type: 'card' | 'cash';
  currency: string;
  // As typed into the field: '1 234,56'
  openingBalance?: string;
  cardDigits?: string[];
};

// The press fires after 500 ms: the finger stays down well past it, so a late frame does not lift it
// before the sheet is there
const HOLD_MS = 700;
// A success toast lives 3 s, and the next one may come a second or two after it, below it
const TOAST_GONE_MS = 10_000;

export async function centerOf(locator: Locator): Promise<Point> {
  await expect(locator).toBeVisible();
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A finger, unlike a mouse, hands the gesture to the browser: it may claim the touch for scrolling,
// and a hold that lifts without a cancelled `touchend` still ends in the mousedown and click of a tap
// (Chromium sends them about 2 ms after the release). So a test of the long press sends real touch
// input, with `test.use({ hasTouch: true, isMobile: true })`.
export async function createFinger(page: Page) {
  const client = await page.context().newCDPSession(page);

  function send(type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Point[]) {
    return client.send('Input.dispatchTouchEvent', { type, touchPoints });
  }

  return {
    press: (point: Point) => send('touchStart', [point]),
    moveTo: (point: Point) => send('touchMove', [point]),
    lift: () => send('touchEnd', []),
  };
}

/** Holds a finger on the middle of the element long enough for the long press to fire. */
export async function longPress(page: Page, locator: Locator): Promise<void> {
  // The toasts of the steps before may still lie over the element: the finger would land on them,
  // and the click of its release would reach the element once they are gone
  await expect.poll(() => isUncoveredAtCenter(locator), { timeout: TOAST_GONE_MS }).toBe(true);

  const finger = await createFinger(page);
  await finger.press(await centerOf(locator));
  await page.waitForTimeout(HOLD_MS);
  await finger.lift();
}

// The row is a `div role="button"`; the line with the name is what tells one row from another
export function accountRow(page: Page, name: string): Locator {
  return page.locator('[role="button"]').filter({ has: page.getByText(name, { exact: true }) });
}

/**
 * Adds an account through the «Счета» tab and its form, the way a person does, and comes back to the
 * list with the new row on it. The app has to be open already.
 */
export async function addAccount(page: Page, options: AccountOptions): Promise<void> {
  const { name, type, currency, openingBalance, cardDigits = [] } = options;

  await page.getByRole('tab', { name: 'Счета' }).click();
  await expect(page).toHaveURL('/accounts');

  // The empty page offers the button itself, a page with accounts the floating one: never both
  await page.getByRole('button', { name: 'Добавить счёт', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Новый счёт' });
  await expect(form).toBeVisible();

  await form.getByLabel('Название*').fill(name);
  // PrimeVue renders a SelectButton as plain buttons with aria-pressed
  await form
    .getByRole('button', { name: type === 'card' ? 'Карта' : 'Наличные', exact: true })
    .click();

  await form.locator('#account_currency').click();
  await page.getByRole('option', { name: new RegExp(`^${currency} `) }).click();

  if (openingBalance !== undefined) await form.getByLabel('Начальный остаток').fill(openingBalance);

  for (const digits of cardDigits) {
    await form.getByLabel('Последние 4 цифры карты').fill(digits);
    await form.getByRole('button', { name: 'Добавить карту', exact: true }).click();
    await expect(form.getByRole('button', { name: `Убрать карту ·${digits}` })).toBeVisible();
  }

  await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(accountRow(page, name)).toBeVisible();
}

function isUncoveredAtCenter(locator: Locator): Promise<boolean> {
  return locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && element.contains(hit);
  });
}
