import { test, expect, gotoTab } from './fixtures.mjs';

test('SIGs health tooltip appears on hover', async ({ page }) => {
  await gotoTab(page, 'sigs');

  // The tooltip should be hidden initially (visibility: hidden)
  const tooltip = page.locator('.sigs-health-tooltip');
  await expect(tooltip).toBeHidden();

  // Hover over the info icon
  await page.locator('.sigs-health-info').hover();

  // The tooltip should now be visible
  await expect(tooltip).toBeVisible();

  // Verify it contains the three legend items
  const text = await tooltip.textContent();
  expect(text).toContain('Well distributed');
  expect(text).toContain('Moderate concentration');
  expect(text).toContain('High concentration');
});
