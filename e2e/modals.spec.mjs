import { test, expect, gotoTab } from './fixtures.mjs';
import { MODALS } from './helpers.mjs';

async function openFirstRow(page, tab, rowSelector, modalId) {
  await gotoTab(page, tab);
  const rows = page.locator(rowSelector);
  if (await rows.count() === 0) test.skip(true, `no ${rowSelector} rows for the default preset/platform`);
  await rows.first().click();
  await expect(page.locator(`#${modalId}`)).toBeVisible();
}

for (const { tab, rowSelector, modalId, closeLabel } of MODALS) {
  test.describe(`${modalId}`, () => {
    test('opens on row click', async ({ page }) => {
      await openFirstRow(page, tab, rowSelector, modalId);
    });

    test('closes via its close button', async ({ page }) => {
      await openFirstRow(page, tab, rowSelector, modalId);
      await page.locator(`#${modalId} button[aria-label="${closeLabel}"]`).click();
      await expect(page.locator(`#${modalId}`)).toBeHidden();
    });

    test('closes via backdrop click', async ({ page }) => {
      await openFirstRow(page, tab, rowSelector, modalId);
      // The backdrop spans the full viewport but the panel is right-aligned and can be
      // wide enough to reach past the default (viewport-center) click point — click a
      // corner instead, which is always outside a right-aligned panel's bounds.
      await page.locator(`#${modalId}-backdrop`).click({ position: { x: 10, y: 10 } });
      await expect(page.locator(`#${modalId}`)).toBeHidden();
    });

    test('closes via Escape without affecting other (already-closed) modals', async ({ page }) => {
      // Excludes noise from third-party logo/avatar image requests, which the app
      // already handles gracefully via onerror and has no control over: failed
      // resource loads (favicon services with incomplete coverage) and browsers'
      // own cross-site cookie-rejection warnings for github.com avatar requests.
      const IGNORED_CONSOLE_ERROR = /^Failed to load resource|Cookie .* has been rejected/;
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && !IGNORED_CONSOLE_ERROR.test(msg.text())) consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => consoleErrors.push(err.message));

      await openFirstRow(page, tab, rowSelector, modalId);
      await page.keyboard.press('Escape');
      await expect(page.locator(`#${modalId}`)).toBeHidden();

      for (const other of MODALS.filter(m => m.modalId !== modalId)) {
        await expect(page.locator(`#${other.modalId}`)).toBeHidden();
      }
      expect(consoleErrors).toEqual([]);
    });
  });
}

test.describe('search then open', () => {
  test('filtering contributors and clicking a filtered row opens the right modal', async ({ page }) => {
    await gotoTab(page, 'contributors');
    const firstRow = page.locator('tr.contrib-row').first();
    const name = (await firstRow.locator('td').nth(1).innerText()).trim().split('\n')[0];

    const query = name.slice(0, Math.min(3, name.length));
    await page.fill('#contributor-search', query);
    await expect(page.locator('#contrib-search-clear')).toBeVisible();

    const filteredRows = page.locator('tr.contrib-row');
    await expect(filteredRows.first()).toBeVisible();
    await filteredRows.first().click();
    await expect(page.locator('#contrib-modal')).toBeVisible();
  });

  test('clearing the search via the clear button restores the full list', async ({ page }) => {
    await gotoTab(page, 'contributors');
    const fullCount = await page.locator('tr.contrib-row').count();

    await page.fill('#contributor-search', 'zzzzznonexistentquery');
    await expect(page.locator('#contrib-search-clear')).toBeVisible();

    await page.click('#contrib-search-clear');
    await expect(page.locator('#contributor-search')).toHaveValue('');
    await expect(page.locator('tr.contrib-row')).toHaveCount(fullCount);
  });
});
