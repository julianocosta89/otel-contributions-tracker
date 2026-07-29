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

// isSuspectedOutage is reused at the end of main() to decide whether hard fails
// (non-404 errors with no cached fallback) are an isolated always-empty repo
// blip or a genuine outage — same ratio, different counters.
test('isSuspectedOutage: false for a single hard fail out of many repo-period attempts (isolated always-empty repo)', () => {
  assert.equal(isSuspectedOutage(1, 81 * 5), false);
});

test('isSuspectedOutage: true when most repo-period attempts hard fail', () => {
  assert.equal(isSuspectedOutage(300, 81 * 5), true);
});
