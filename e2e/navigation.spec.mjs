import { test, expect, gotoTab, clickTab } from './fixtures.mjs';
import { TABS, PRESETS } from './helpers.mjs';

test.describe('tab switching via click', () => {
  for (const tab of TABS) {
    test(`clicking the ${tab} tab shows its panel and marks it active`, async ({ page }) => {
      await gotoTab(page, 'overview');
      await clickTab(page, tab);

      await expect(page.locator(`#tab-${tab}`)).toBeVisible();
      for (const other of TABS.filter(t => t !== tab)) {
        await expect(page.locator(`#tab-${other}`)).toBeHidden();
      }

      const button = page.locator(`#tab-btn-${tab}`);
      await expect(button).toHaveClass(/active/);
      await expect(button).toHaveAttribute('aria-selected', 'true');

      await expect(page).toHaveURL(new RegExp(`#${tab}(/|$)`));
    });
  }
});

test.describe('tab switching via direct hash URL', () => {
  for (const tab of TABS) {
    test(`navigating straight to #${tab} loads that tab`, async ({ page }) => {
      await gotoTab(page, tab);

      await expect(page.locator(`#tab-${tab}`)).toBeVisible();
      const button = page.locator(`#tab-btn-${tab}`);
      await expect(button).toHaveClass(/active/);
      await expect(button).toHaveAttribute('aria-selected', 'true');
    });
  }
});

test.describe('timeframe presets via hash', () => {
  for (const preset of PRESETS) {
    test(`#overview/${preset} applies the ${preset} preset`, async ({ page }) => {
      await gotoTab(page, 'overview', { preset });
      await expect(page.locator(`.preset-btn[data-preset="${preset}"]`)).toHaveClass(/bg-blue-600/);
    });
  }

  test('a custom date range deep-link renders with no preset marked active', async ({ page }) => {
    await gotoTab(page, 'overview', { preset: '2024-01-01..2024-06-01' });
    const activePresets = await page.locator('.preset-btn.bg-blue-600').count();
    expect(activePresets).toBe(0);
  });

  test('an unknown timeframe silently redirects to 1y', async ({ page }) => {
    await gotoTab(page, 'overview', { preset: 'not-a-real-preset' });
    await expect(page.locator('.preset-btn[data-preset="1y"]')).toHaveClass(/bg-blue-600/);
    await expect(page).toHaveURL(/#overview\/1y/);
  });
});

test.describe('browser back/forward', () => {
  test('back/forward across two hash navigations restores each tab', async ({ page }) => {
    await gotoTab(page, 'overview');
    await gotoTab(page, 'sigs');

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.goBack();
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'overview');
    await expect(page.locator('#tab-overview')).toBeVisible();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.goForward();
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'sigs');
    await expect(page.locator('#tab-sigs')).toBeVisible();
  });
});

test.describe('deep-linked modal opening', () => {
  test('opening an organization row deep-links to it, and re-visiting that link reopens the modal', async ({ page }) => {
    await gotoTab(page, 'organizations');
    await page.locator('tr.org-row').first().click();
    await expect(page.locator('#org-modal')).toBeVisible();

    const hash = await page.evaluate(() => location.hash);
    await page.locator('#org-modal button[aria-label="Close organization details"]').click();
    await expect(page.locator('#org-modal')).toBeHidden();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.goto(`/${hash}`);
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'organizations');
    await expect(page.locator('#org-modal')).toBeVisible();
  });

  test('opening a SIG row deep-links to it, and re-visiting that link reopens the modal', async ({ page }) => {
    await gotoTab(page, 'sigs');
    await page.locator('tr.sig-row').first().click();
    await expect(page.locator('#sig-modal')).toBeVisible();

    const hash = await page.evaluate(() => location.hash);
    await page.keyboard.press('Escape');
    await expect(page.locator('#sig-modal')).toBeHidden();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.goto(`/${hash}`);
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'sigs');
    await expect(page.locator('#sig-modal')).toBeVisible();
  });

  test('opening a coverage row deep-links to it, and re-visiting that link reopens the modal', async ({ page }) => {
    await gotoTab(page, 'coverage');
    const rows = page.locator('tr.coverage-row');
    if (await rows.count() === 0) test.skip(true, 'no coverage rows for the default preset/platform');

    await rows.first().click();
    await expect(page.locator('#coverage-modal')).toBeVisible();

    const hash = await page.evaluate(() => location.hash);
    await page.locator('#coverage-modal button[aria-label="Close coverage details"]').click();
    await expect(page.locator('#coverage-modal')).toBeHidden();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.goto(`/${hash}`);
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'coverage');
    await expect(page.locator('#coverage-modal')).toBeVisible();
  });

  test('opening a contributor row deep-links to it, and re-visiting that link reopens the modal', async ({ page }) => {
    await gotoTab(page, 'contributors');
    await page.locator('tr.contrib-row').first().click();
    await expect(page.locator('#contrib-modal')).toBeVisible();

    const hash = await page.evaluate(() => location.hash);
    await page.locator('#contrib-modal button[aria-label="Close contributor details"]').click();
    await expect(page.locator('#contrib-modal')).toBeHidden();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.goto(`/${hash}`);
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'contributors');
    await expect(page.locator('#contrib-modal')).toBeVisible();
  });

  test('a deep-link to a nonexistent organization renders the tab without opening a modal', async ({ page }) => {
    await gotoTab(page, 'organizations', { preset: '1y', detail: 'this-org-does-not-exist-xyz' });
    await expect(page.locator('#tab-organizations')).toBeVisible();
    await expect(page.locator('#org-modal')).toBeHidden();
  });
});
