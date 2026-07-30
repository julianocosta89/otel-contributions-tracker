import { test, expect, gotoTab, scanForViolations } from './fixtures.mjs';
import { TABS, MODALS } from './helpers.mjs';

test.describe('accessibility — tabs', () => {
  for (const tab of TABS) {
    test(`${tab} tab has no WCAG A/AA violations`, async ({ page }) => {
      await gotoTab(page, tab);
      const violations = await scanForViolations(page);
      expect(violations, formatViolations(violations)).toEqual([]);
    });
  }
});

test.describe('accessibility — modals', () => {
  for (const { tab, rowSelector, modalId } of MODALS) {
    test(`${modalId} has no WCAG A/AA violations when open`, async ({ page }) => {
      await gotoTab(page, tab);
      const rows = page.locator(rowSelector);
      if (await rows.count() === 0) test.skip(true, `no ${rowSelector} rows for the default preset/platform`);

      await rows.first().click();
      await expect(page.locator(`#${modalId}`)).toBeVisible();

      const violations = await scanForViolations(page, { include: `#${modalId}-panel` });
      expect(violations, formatViolations(violations)).toEqual([]);
    });
  }
});

function formatViolations(violations) {
  return violations
    .map(v => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
    .join('\n');
}
