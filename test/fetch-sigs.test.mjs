import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUsableCache, isSuspectedOutage } from '../scripts/fetch-sigs.mjs';

// ── isUsableCache ─────────────────────────────────────────────────────────────

test('isUsableCache: rejects undefined (no cache entry at all)', () => {
  assert.equal(isUsableCache(undefined), false);
});

test('isUsableCache: rejects an EMPTY_REPO-shaped stub', () => {
  assert.equal(isUsableCache({ contributors: { total: 0, data: [] }, organizations: { total: 0, data: [] } }), false);
});

test('isUsableCache: accepts an entry with contributor data', () => {
  assert.equal(isUsableCache({ contributors: { total: 5, data: [] }, organizations: { total: 0, data: [] } }), true);
});

test('isUsableCache: accepts an entry with only organization data', () => {
  assert.equal(isUsableCache({ contributors: { total: 0, data: [] }, organizations: { total: 2, data: [] } }), true);
});

// ── isSuspectedOutage ─────────────────────────────────────────────────────────

test('isSuspectedOutage: false when no repos 404', () => {
  assert.equal(isSuspectedOutage(0, 80), false);
});

test('isSuspectedOutage: false for a handful of legitimately-empty repos', () => {
  assert.equal(isSuspectedOutage(3, 80), false);
});

test('isSuspectedOutage: false exactly at the 50% boundary', () => {
  assert.equal(isSuspectedOutage(40, 80), false);
});

test('isSuspectedOutage: true just above the 50% boundary', () => {
  assert.equal(isSuspectedOutage(41, 80), true);
});

test('isSuspectedOutage: true when every repo 404s', () => {
  assert.equal(isSuspectedOutage(80, 80), true);
});

test('isSuspectedOutage: false when there are no repos to check', () => {
  assert.equal(isSuspectedOutage(0, 0), false);
});

// isSuspectedOutage is also used per-period in main() to decide whether hard
// fails (non-404 errors with no cached fallback) are an isolated always-empty
// repo blip or a genuine outage for that period — checked against that
// period's own repo count, not a run-wide total across all periods.
test('isSuspectedOutage: false for a single hard fail in one period (isolated always-empty repo)', () => {
  assert.equal(isSuspectedOutage(1, 81), false);
});

test('isSuspectedOutage: true when every repo in a single period hard-fails', () => {
  // This must trip even though, diluted across e.g. 5 periods (81/405 = 20%),
  // it would look isolated — the per-period check is what catches a genuine
  // full-period outage that a run-wide ratio would hide.
  assert.equal(isSuspectedOutage(81, 81), true);
});
