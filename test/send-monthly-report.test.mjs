import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthWindow, monthLabel, computeGrowth, escapeHtml, dayAfter } from '../scripts/send-monthly-report.mjs';

// ── monthWindow ──────────────────────────────────────────────────────────────

test('monthWindow: mid-month reference returns previous calendar month, endDate is the last actual day', () => {
  const r = monthWindow('2026-07-15');
  assert.deepEqual(r, { key: '2026-06', startDate: '2026-06-01', endDate: '2026-06-30' });
});

test('monthWindow: first of month reference still returns the prior month (31-day month)', () => {
  const r = monthWindow('2026-08-01T08:00:00Z');
  assert.deepEqual(r, { key: '2026-07', startDate: '2026-07-01', endDate: '2026-07-31' });
});

test('monthWindow: January rolls back to December of the previous year', () => {
  const r = monthWindow('2026-01-15');
  assert.deepEqual(r, { key: '2025-12', startDate: '2025-12-01', endDate: '2025-12-31' });
});

test('monthWindow: leap-year February has 29 days', () => {
  const r = monthWindow('2024-03-10');
  assert.deepEqual(r, { key: '2024-02', startDate: '2024-02-01', endDate: '2024-02-29' });
});

test('monthWindow: non-leap-year February has 28 days', () => {
  const r = monthWindow('2026-03-10');
  assert.deepEqual(r, { key: '2026-02', startDate: '2026-02-01', endDate: '2026-02-28' });
});

test('monthWindow: --month override bypasses refDate entirely', () => {
  const r = monthWindow('2026-01-01', '2026-06');
  assert.deepEqual(r, { key: '2026-06', startDate: '2026-06-01', endDate: '2026-06-30' });
});

test('monthWindow: --month override rolls forward across a year boundary', () => {
  const r = monthWindow('2020-01-01', '2025-12');
  assert.deepEqual(r, { key: '2025-12', startDate: '2025-12-01', endDate: '2025-12-31' });
});

test('monthWindow: rejects a malformed --month override', () => {
  assert.throws(() => monthWindow('2026-01-01', '2026/06'), /Invalid --month value/);
});

test('monthWindow: rejects a --month override with an out-of-range month number', () => {
  assert.throws(() => monthWindow('2026-01-01', '2026-13'), /month must be 01-12/);
  assert.throws(() => monthWindow('2026-01-01', '2026-00'), /month must be 01-12/);
});

// ── dayAfter ─────────────────────────────────────────────────────────────────

test('dayAfter: mid-month day advances by one', () => {
  assert.equal(dayAfter('2026-06-15'), '2026-06-16');
});

test('dayAfter: last day of a 30-day month rolls into the next month', () => {
  assert.equal(dayAfter('2026-06-30'), '2026-07-01');
});

test('dayAfter: last day of December rolls into the next year', () => {
  assert.equal(dayAfter('2025-12-31'), '2026-01-01');
});

test('dayAfter: leap-year Feb 29 rolls into March 1st', () => {
  assert.equal(dayAfter('2024-02-29'), '2024-03-01');
});

// ── monthLabel ───────────────────────────────────────────────────────────────

test('monthLabel: formats a YYYY-MM key as "Month YYYY"', () => {
  assert.equal(monthLabel('2026-06'), 'June 2026');
});

// ── computeGrowth ─────────────────────────────────────────────────────────────

test('computeGrowth: no prior snapshot yields no-baseline status', () => {
  assert.deepEqual(computeGrowth(100, null), { status: 'no-baseline' });
});

test('computeGrowth: zero-to-zero yields flat status', () => {
  assert.deepEqual(computeGrowth(0, 0), { status: 'flat' });
});

test('computeGrowth: zero-to-positive yields new status', () => {
  assert.deepEqual(computeGrowth(50, 0), { status: 'new' });
});

test('computeGrowth: normal increase computes a positive percentage', () => {
  const r = computeGrowth(150, 100);
  assert.equal(r.status, 'ok');
  assert.equal(r.value, 50);
});

test('computeGrowth: normal decrease computes a negative percentage', () => {
  const r = computeGrowth(75, 100);
  assert.equal(r.status, 'ok');
  assert.equal(r.value, -25);
});

// ── escapeHtml ─────────────────────────────────────────────────────────────

test('escapeHtml: escapes angle brackets, quotes, and ampersands', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror=alert(1)> & "quoted" & 'single'`),
    '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot; &amp; &#39;single&#39;'
  );
});

test('escapeHtml: leaves plain text untouched', () => {
  assert.equal(escapeHtml('Yang Song (songy23)'), 'Yang Song (songy23)');
});

test('escapeHtml: coerces non-string input', () => {
  assert.equal(escapeHtml(42), '42');
});
