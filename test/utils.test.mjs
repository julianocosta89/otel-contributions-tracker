import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDependency, dependencyColor } from '../js/utils.js';

// ── computeDependency ────────────────────────────────────────────────────────

test('computeDependency: returns null for null/undefined input', () => {
  assert.equal(computeDependency(null), null);
  assert.equal(computeDependency(undefined), null);
});

test('computeDependency: returns null for empty array', () => {
  assert.equal(computeDependency([]), null);
});

test('computeDependency: returns null when total contributions is 0', () => {
  assert.equal(computeDependency([{ contributions: 0 }, { contributions: 0 }]), null);
});

test('computeDependency: single contributor reaches 51% immediately', () => {
  const result = computeDependency([{ contributions: 100 }]);
  assert.equal(result.topCount, 1);
  assert.equal(result.topPercentage, 100);
  assert.equal(result.otherCount, 0);
});

test('computeDependency: one contributor with >51% share', () => {
  const result = computeDependency([
    { contributions: 60 },
    { contributions: 30 },
    { contributions: 10 },
  ]);
  assert.equal(result.topCount, 1);
  assert.equal(result.topPercentage, 60);
  assert.equal(result.otherCount, 2);
});

test('computeDependency: needs two contributors to reach 51%', () => {
  const result = computeDependency([
    { contributions: 40 },
    { contributions: 35 },
    { contributions: 25 },
  ]);
  assert.equal(result.topCount, 2);
  assert.equal(result.topPercentage, 75);
  assert.equal(result.otherCount, 1);
});

test('computeDependency: needs all contributors when evenly distributed', () => {
  const result = computeDependency([
    { contributions: 25 },
    { contributions: 25 },
    { contributions: 25 },
    { contributions: 25 },
  ]);
  // 3 of 4 = 75% ≥ 51%
  assert.equal(result.topCount, 3);
  assert.equal(result.topPercentage, 75);
  assert.equal(result.otherCount, 1);
});

test('computeDependency: exactly 51% boundary is included', () => {
  // 51/100 = 0.51 ≥ 0.51 → stops at 1
  const result = computeDependency([
    { contributions: 51 },
    { contributions: 49 },
  ]);
  assert.equal(result.topCount, 1);
  assert.equal(result.topPercentage, 51);
  assert.equal(result.otherCount, 1);
});

test('computeDependency: just under 51% boundary requires next entry', () => {
  // 50/100 = 0.5 < 0.51 → needs the second entry too
  const result = computeDependency([
    { contributions: 50 },
    { contributions: 50 },
  ]);
  assert.equal(result.topCount, 2);
  assert.equal(result.topPercentage, 100);
  assert.equal(result.otherCount, 0);
});

test('computeDependency: sorts by contributions descending before accumulating', () => {
  // Input is intentionally unsorted
  const result = computeDependency([
    { contributions: 10 },
    { contributions: 70 },
    { contributions: 20 },
  ]);
  assert.equal(result.topCount, 1);
  assert.equal(result.topPercentage, 70);
  assert.equal(result.otherCount, 2);
});

test('computeDependency: does not mutate input array', () => {
  const input = [{ contributions: 30 }, { contributions: 70 }];
  const snapshot = input.map(i => ({ ...i }));
  computeDependency(input);
  assert.deepEqual(input, snapshot);
});

// ── dependencyColor ───────────────────────────────────────────────────────────

test('dependencyColor: returns null for null topPercentage', () => {
  assert.equal(dependencyColor(null, 5), null);
});

test('dependencyColor: green when topPercentage < 51', () => {
  assert.equal(dependencyColor(40, 10), 'green');
  assert.equal(dependencyColor(50, 10), 'green');
});

test('dependencyColor: yellow when 51 ≤ topPercentage < 80', () => {
  assert.equal(dependencyColor(51, 10), 'yellow');
  assert.equal(dependencyColor(75, 10), 'yellow');
  assert.equal(dependencyColor(79, 10), 'yellow');
});

test('dependencyColor: red when topPercentage ≥ 80', () => {
  assert.equal(dependencyColor(80, 10), 'red');
  assert.equal(dependencyColor(100, 10), 'red');
});

// ── bus-factor overrides ──────────────────────────────────────────────────────

test('dependencyColor: topCount ≤ 1 is always red (single point of failure)', () => {
  assert.equal(dependencyColor(40, 1), 'red');   // would be green by percentage
  assert.equal(dependencyColor(60, 1), 'red');   // would be yellow by percentage
  assert.equal(dependencyColor(90, 1), 'red');   // already red
});

test('dependencyColor: topCount = 2 is at least yellow (bus-factor risk)', () => {
  assert.equal(dependencyColor(40, 2), 'yellow'); // would be green by percentage
  assert.equal(dependencyColor(60, 2), 'yellow'); // already yellow
  assert.equal(dependencyColor(90, 2), 'red');    // already red
});

test('dependencyColor: topCount = 2 does not escalate yellow to red', () => {
  // 60% with 2 top contributors → yellow, not red
  assert.equal(dependencyColor(60, 2), 'yellow');
});

test('dependencyColor: topCount ≥ 3 uses percentage thresholds unchanged', () => {
  assert.equal(dependencyColor(40, 3), 'green');
  assert.equal(dependencyColor(60, 3), 'yellow');
  assert.equal(dependencyColor(90, 3), 'red');
});
