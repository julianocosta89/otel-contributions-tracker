// Runs only on the chromium-small/medium/large projects (see playwright.config.mjs),
// one breakpoint per viewport width rather than a loop inside a single test —
// that gives each breakpoint its own row in the HTML report and lets
// `--project=chromium-small` target just one width while debugging.

import { test, expect, gotoTab } from './fixtures.mjs';

test('the tab nav and its scroll strip are visible', async ({ page }) => {
  await gotoTab(page, 'overview');
  await expect(page.locator('[role="tablist"]')).toBeVisible();
  await expect(page.locator('#tab-btn-contributors')).toBeVisible();
});

test('switching tabs still works at this viewport', async ({ page }) => {
  await gotoTab(page, 'overview');
  await page.evaluate(() => { window.__lastTabLoaded = null; });
  await page.locator('#tab-btn-sigs').click();
  await page.waitForFunction(t => window.__lastTabLoaded === t, 'sigs');
  await expect(page.locator('#tab-sigs')).toBeVisible();
});

test('the page has no horizontal overflow', async ({ page }) => {
  await gotoTab(page, 'overview');
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
});

test('key controls and data are visible', async ({ page }) => {
  await gotoTab(page, 'contributors');
  await expect(page.locator('.preset-btn[data-preset="1y"]')).toBeVisible();
  await expect(page.locator('#platform')).toBeVisible();
  await expect(page.locator('button[aria-label="Toggle light/dark mode"]')).toBeVisible();
  await expect(page.locator('tr.contrib-row').first()).toBeVisible();
});

test('an open modal fits within the viewport width', async ({ page }) => {
  await gotoTab(page, 'organizations');
  await page.locator('tr.org-row').first().click();
  await expect(page.locator('#org-modal')).toBeVisible();

  const viewportWidth = page.viewportSize().width;
  const panelBox = await page.locator('#org-modal-panel').boundingBox();
  // +1px tolerance for sub-pixel layout rounding (e.g. 375.00003 vs 375).
  expect(panelBox.width).toBeLessThanOrEqual(viewportWidth + 1);

  await expect(page.locator('#org-modal button[aria-label="Close organization details"]')).toBeVisible();
});
