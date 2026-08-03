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

// The org modal's Repositories tile and the coverage modal's People tile link to each
// other's per-org detail. Unlike other in-app links, these hash-navigate (rather than
// calling the other modal's open function directly) specifically so the underlying tab
// switches too — see js/modals/org.js and js/modals/coverage.js.
test.describe('cross-modal navigation (Organizations ↔ Coverage)', () => {
  test('the Repositories link switches to Coverage, and its back link returns to Organizations', async ({ page }) => {
    await gotoTab(page, 'organizations');
    await page.locator('tr.org-row').first().click();
    await expect(page.locator('#org-modal')).toBeVisible();

    const orgName = (await page.locator('#org-modal-name').innerText()).trim();
    const repoTile = page.locator('#org-modal-repo-count');
    // The tile starts as a spinner and resolves asynchronously (openOrgModal() awaits
    // loadSigsCache()) to either a clickable <button> or a plain dash — wait for that to
    // settle before deciding whether to skip, rather than racing a one-shot read against it.
    await expect(repoTile.locator('.spinner')).toHaveCount(0);
    const repoButton = repoTile.locator('button');
    if (await repoButton.count() === 0) {
      test.skip(true, 'Coverage data unavailable for the default preset/platform (tile is a plain dash)');
    }

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await repoButton.click();
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'coverage');

    await expect(page.locator('#tab-coverage')).toBeVisible();
    await expect(page.locator('#tab-organizations')).toBeHidden();
    await expect(page.locator('#coverage-modal')).toBeVisible();
    await expect(page.locator('#coverage-modal-name')).toHaveText(orgName);
    // Plain string checks rather than a RegExp built from the org name — encodeURIComponent
    // leaves some characters (e.g. parentheses) unescaped, which are regex metacharacters.
    let hash = await page.evaluate(() => location.hash);
    expect(hash.startsWith('#coverage/')).toBe(true);
    expect(hash.endsWith(`/${encodeURIComponent(orgName)}`)).toBe(true);

    const backButton = page.locator('#coverage-modal-back');
    await expect(backButton).toBeVisible();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await backButton.click();
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'organizations');

    await expect(page.locator('#tab-organizations')).toBeVisible();
    await expect(page.locator('#tab-coverage')).toBeHidden();
    await expect(page.locator('#org-modal')).toBeVisible();
    await expect(page.locator('#org-modal-name')).toHaveText(orgName);
    hash = await page.evaluate(() => location.hash);
    expect(hash.startsWith('#organizations/')).toBe(true);
    expect(hash.endsWith(`/${encodeURIComponent(orgName)}`)).toBe(true);
  });

  test('the Repositories link is keyboard-focusable and activatable via Enter', async ({ page }) => {
    // Regression check for the tile being a real <button> rather than a clickable <div>:
    // a div with only an onclick handler is neither focusable nor triggered by Enter/Space.
    await gotoTab(page, 'organizations');
    await page.locator('tr.org-row').first().click();
    await expect(page.locator('#org-modal')).toBeVisible();

    const repoTile = page.locator('#org-modal-repo-count');
    await expect(repoTile.locator('.spinner')).toHaveCount(0);
    const repoButton = repoTile.locator('button');
    if (await repoButton.count() === 0) {
      test.skip(true, 'Coverage data unavailable for the default preset/platform (tile is a plain dash)');
    }

    await repoButton.focus();
    await expect(repoButton).toBeFocused();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.keyboard.press('Enter');
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'coverage');

    await expect(page.locator('#tab-coverage')).toBeVisible();
    await expect(page.locator('#coverage-modal')).toBeVisible();
  });

  test('the People link switches to Organizations, and its back link returns to Coverage', async ({ page }) => {
    await gotoTab(page, 'coverage');
    const rows = page.locator('tr.coverage-row');
    if (await rows.count() === 0) test.skip(true, 'no coverage rows for the default preset/platform');

    await rows.first().click();
    await expect(page.locator('#coverage-modal')).toBeVisible();

    const orgName = (await page.locator('#coverage-modal-name').innerText()).trim();
    const peopleButton = page.locator('#coverage-modal-people-count button');
    await expect(peopleButton).toHaveClass(/cursor-pointer/);

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await peopleButton.click();
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'organizations');

    await expect(page.locator('#tab-organizations')).toBeVisible();
    await expect(page.locator('#tab-coverage')).toBeHidden();
    await expect(page.locator('#org-modal')).toBeVisible();
    await expect(page.locator('#org-modal-name')).toHaveText(orgName);

    const backButton = page.locator('#org-modal-back');
    await expect(backButton).toBeVisible();

    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await backButton.click();
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'coverage');

    await expect(page.locator('#tab-coverage')).toBeVisible();
    await expect(page.locator('#coverage-modal')).toBeVisible();
    await expect(page.locator('#coverage-modal-name')).toHaveText(orgName);
  });

  test('back links stay hidden when a modal is opened directly, without a cross-modal breadcrumb', async ({ page }) => {
    await gotoTab(page, 'organizations');
    await page.locator('tr.org-row').first().click();
    await expect(page.locator('#org-modal')).toBeVisible();
    await expect(page.locator('#org-modal-back')).toBeHidden();

    // Modals cover the whole viewport (including the nav bar), so a real user can only
    // reach another tab by closing this one first — do the same here rather than
    // hash-navigating out from under it, which no in-app interaction can actually do.
    await page.keyboard.press('Escape');
    await expect(page.locator('#org-modal')).toBeHidden();

    await gotoTab(page, 'coverage');
    const rows = page.locator('tr.coverage-row');
    if (await rows.count() === 0) test.skip(true, 'no coverage rows for the default preset/platform');
    await rows.first().click();
    await expect(page.locator('#coverage-modal')).toBeVisible();
    await expect(page.locator('#coverage-modal-back')).toBeHidden();
  });

  test('the Repositories tile is a plain, non-interactive dash when Coverage has no data for the filter (platform ≠ "All platforms")', async ({ page }) => {
    await gotoTab(page, 'organizations');
    await page.evaluate(() => { window.__lastTabLoaded = null; });
    await page.selectOption('#platform', 'github');
    await page.waitForFunction(t => window.__lastTabLoaded === t, 'organizations');

    const rows = page.locator('tr.org-row');
    if (await rows.count() === 0) test.skip(true, 'no organization rows for the github platform/default preset');
    await rows.first().click();
    await expect(page.locator('#org-modal')).toBeVisible();

    const repoTile = page.locator('#org-modal-repo-count');
    await expect(repoTile).toHaveText('—');
    await expect(repoTile.locator('button')).toHaveCount(0);

    const hashBefore = await page.evaluate(() => location.hash);
    await repoTile.click();
    await expect(page.locator('#tab-organizations')).toBeVisible();
    expect(await page.evaluate(() => location.hash)).toBe(hashBefore);
  });
});
