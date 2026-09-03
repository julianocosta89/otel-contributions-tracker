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

// The Maintainers / Approvers stat tiles in the org modal are buttons that filter the
// contributor list to the people behind each tile's count (highest role org-wide —
// a maintainer anywhere never also shows up under Approvers). Data-driven off the
// first org row, same as the modal tests above; skips if that org has neither role.
test.describe('org modal role tiles', () => {
  const TILES = [
    { id: 'maintainer', label: 'Maintainers' },
    { id: 'approver',   label: 'Approvers' },
  ];

  test.beforeEach(async ({ page }) => {
    await gotoTab(page, 'organizations');
    const rows = page.locator('tr.org-row');
    if (await rows.count() === 0) test.skip(true, 'no org rows for the default preset/platform');
    await rows.first().click();
    await expect(page.locator('#org-modal')).toBeVisible();
  });

  test('clicking a role tile filters the contributor list, and the chip clears it', async ({ page }) => {
    const counts = {};
    for (const t of TILES) {
      counts[t.id] = parseInt((await page.locator(`#org-modal-${t.id}-count`).innerText()).replace(/,/g, ''), 10);
    }
    const clickable = TILES.filter(t => counts[t.id] > 0);
    test.skip(clickable.length === 0, 'first org has no maintainers or approvers');

    const tile = page.locator(`#org-modal-${clickable[0].id}-tile`);
    await tile.click();

    // Chip appears next to the Contributors heading, labeled with the role and
    // "shown / total" — shown must match the tile's own count exactly.
    await expect(page.locator('#org-modal-role-filter')).toBeVisible();
    await expect(page.locator('#org-modal-role-filter-label')).toHaveText(clickable[0].label);
    await expect(page.locator('#org-modal-role-filter-nums')).toHaveText(new RegExp(`^${counts[clickable[0].id]} /`));
    await expect(tile).toHaveAttribute('aria-pressed', 'true');

    // The filtered list holds exactly that many person rows (rank spans distinguish
    // person rows from the optional active/inactive divider row).
    await expect(page.locator('#org-modal-contrib-list > div:has(> span.text-right)'))
      .toHaveCount(counts[clickable[0].id]);

    // Clicking the chip clears the filter and returns to the full list
    await page.locator('#org-modal-role-filter').click();
    await expect(page.locator('#org-modal-role-filter')).toBeHidden();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking the active tile again toggles the filter off, and the other tile switches filters', async ({ page }) => {
    const counts = {};
    for (const t of TILES) {
      counts[t.id] = parseInt((await page.locator(`#org-modal-${t.id}-count`).innerText()).replace(/,/g, ''), 10);
    }
    const clickable = TILES.filter(t => counts[t.id] > 0);
    test.skip(clickable.length === 0, 'first org has no maintainers or approvers');

    const first = page.locator(`#org-modal-${clickable[0].id}-tile`);
    await first.click();
    await expect(page.locator('#org-modal-role-filter')).toBeVisible();

    // Toggle off by clicking the same tile again
    await first.click();
    await expect(page.locator('#org-modal-role-filter')).toBeHidden();
    await expect(first).toHaveAttribute('aria-pressed', 'false');

    // If the other role is present too, clicking its tile switches the filter directly
    if (clickable.length > 1) {
      const second = page.locator(`#org-modal-${clickable[1].id}-tile`);
      await first.click();
      await second.click();
      await expect(page.locator('#org-modal-role-filter-label')).toHaveText(clickable[1].label);
      await expect(second).toHaveAttribute('aria-pressed', 'true');
      await expect(first).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('keyboard activation works and reopening the modal resets the filter', async ({ page }) => {
    const counts = {};
    for (const t of TILES) {
      counts[t.id] = parseInt((await page.locator(`#org-modal-${t.id}-count`).innerText()).replace(/,/g, ''), 10);
    }
    const clickable = TILES.filter(t => counts[t.id] > 0);
    test.skip(clickable.length === 0, 'first org has no maintainers or approvers');

    // Enter on the focused tile activates it like a click
    const tile = page.locator(`#org-modal-${clickable[0].id}-tile`);
    await tile.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#org-modal-role-filter')).toBeVisible();

    // Reopening the modal (close → click the same row) starts unfiltered again
    await page.locator('#org-modal button[aria-label="Close organization details"]').click();
    await expect(page.locator('#org-modal')).toBeHidden();
    await page.locator('tr.org-row').first().click();
    await expect(page.locator('#org-modal')).toBeVisible();
    await expect(page.locator('#org-modal-role-filter')).toBeHidden();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');
  });

  test('tiles with a zero count are disabled and not clickable', async ({ page }) => {
    const zeroTiles = [];
    for (const t of TILES) {
      const count = parseInt((await page.locator(`#org-modal-${t.id}-count`).innerText()).replace(/,/g, ''), 10);
      if (count === 0) zeroTiles.push(page.locator(`#org-modal-${t.id}-tile`));
    }
    test.skip(zeroTiles.length === 0, 'first org has both maintainers and approvers');

    for (const tile of zeroTiles) {
      await expect(tile).toBeDisabled();
      await tile.click({ force: true }); // a disabled button ignores clicks, but force it to make sure nothing fires
      await expect(page.locator('#org-modal-role-filter')).toBeHidden();
      await expect(tile).toHaveAttribute('aria-pressed', 'false');
    }
  });
});

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
