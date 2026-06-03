import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetween,
  intersectingRanges,
  buildSubWindows,
  clampRange,
  enrichWithAttribution,
  TOP_N,
} from '../scripts/enrich-attribution.mjs';

// ── daysBetween ───────────────────────────────────────────────────────────────

test('daysBetween: 365-day year', () => {
  assert.equal(daysBetween('2024-01-01', '2025-01-01'), 366); // 2024 is leap year
});

test('daysBetween: same day is 0', () => {
  assert.equal(daysBetween('2025-01-01', '2025-01-01'), 0);
});

// ── intersectingRanges ────────────────────────────────────────────────────────

const RANGES = [
  { company: 'OldCo', from: null,         until: '2020-01-01' },
  { company: 'MidCo', from: '2020-01-01', until: '2023-06-01' },
  { company: 'NewCo', from: '2023-06-01', until: null         },
];

test('intersectingRanges: fully inside window returns matching range', () => {
  const result = intersectingRanges(RANGES, '2021-01-01', '2022-01-01');
  assert.equal(result.length, 1);
  assert.equal(result[0].company, 'MidCo');
});

test('intersectingRanges: window spanning two ranges returns both', () => {
  const result = intersectingRanges(RANGES, '2022-01-01', '2024-01-01');
  assert.equal(result.length, 2);
  assert.equal(result[0].company, 'MidCo');
  assert.equal(result[1].company, 'NewCo');
});

test('intersectingRanges: window entirely after all closed ranges returns none', () => {
  const closed = [
    { company: 'A', from: '2010-01-01', until: '2015-01-01' },
    { company: 'B', from: '2015-01-01', until: '2020-01-01' },
  ];
  const result = intersectingRanges(closed, '2025-01-01', '2026-01-01');
  assert.equal(result.length, 0);
});

test('intersectingRanges: open-ended range matches any future window', () => {
  const result = intersectingRanges(RANGES, '2099-01-01', '2100-01-01');
  assert.equal(result.length, 1);
  assert.equal(result[0].company, 'NewCo');
});

test('intersectingRanges: range ending exactly at window start is excluded', () => {
  // until=2020-01-01, startDate=2020-01-01 → r.until > startDate is false
  const result = intersectingRanges(RANGES, '2020-01-01', '2021-01-01');
  assert.equal(result.find(r => r.company === 'OldCo'), undefined);
});

// ── buildSubWindows ───────────────────────────────────────────────────────────

test('buildSubWindows: single split date produces two windows', () => {
  const wins = buildSubWindows('2024-01-01', ['2025-01-01'], '2026-01-01');
  assert.deepEqual(wins, [
    ['2024-01-01', '2025-01-01'],
    ['2025-01-01', '2026-01-01'],
  ]);
});

test('buildSubWindows: no split dates produces one window', () => {
  const wins = buildSubWindows('2024-01-01', [], '2025-01-01');
  assert.deepEqual(wins, [['2024-01-01', '2025-01-01']]);
});

test('buildSubWindows: split dates outside window are ignored', () => {
  const wins = buildSubWindows('2024-01-01', ['2023-01-01', '2025-06-01', '2027-01-01'], '2026-01-01');
  assert.deepEqual(wins, [
    ['2024-01-01', '2025-06-01'],
    ['2025-06-01', '2026-01-01'],
  ]);
});

// ── clampRange ────────────────────────────────────────────────────────────────

test('clampRange: null from clamps to startDate', () => {
  const r = clampRange({ from: null, until: '2025-06-01' }, '2024-01-01', '2026-01-01');
  assert.equal(r.from, '2024-01-01');
  assert.equal(r.until, '2025-06-01');
});

test('clampRange: null until clamps to endDate', () => {
  const r = clampRange({ from: '2025-01-01', until: null }, '2024-01-01', '2026-01-01');
  assert.equal(r.from, '2025-01-01');
  assert.equal(r.until, '2026-01-01');
});

test('clampRange: from before window start clamps to startDate', () => {
  const r = clampRange({ from: '2010-01-01', until: '2025-01-01' }, '2024-01-01', '2026-01-01');
  assert.equal(r.from, '2024-01-01');
});

test('clampRange: until after window end clamps to endDate', () => {
  const r = clampRange({ from: '2025-01-01', until: '2030-01-01' }, '2024-01-01', '2026-01-01');
  assert.equal(r.until, '2026-01-01');
});

// ── enrichWithAttribution ─────────────────────────────────────────────────────

function makeAffiliations(handle, ranges) {
  return {
    [handle]: {
      company: ranges.at(-1).company,
      ranges,
      file: 1, lineStart: 1, lineEnd: ranges.length + 1,
    },
  };
}

// Mock apiGet: returns sub-period leaderboard keyed by "startDate|endDate"
function makeMockGet(subPeriodData) {
  return async (_path, params) => {
    const key  = `${params.startDate}|${params.endDate}`;
    const data = subPeriodData[key] ?? [];
    return { meta: { offset: 0, limit: 200, total: data.length }, data };
  };
}
const noopSleep = async () => {};

test('enrichWithAttribution: top-N split contributor gets actual counts', async () => {
  const contributors = {
    data: [
      { name: 'Alice', githubHandleArray: ['alice'], contributions: 1200, percentage: 1.0 },
    ],
  };
  const affiliations = makeAffiliations('alice', [
    { company: 'OldCo', from: null,         until: '2025-01-01' },
    { company: 'NewCo', from: '2025-01-01', until: null         },
  ]);
  const mockGet = makeMockGet({
    '2024-01-01|2025-01-01': [{ name: 'Alice', githubHandleArray: ['alice'], contributions: 500 }],
    '2025-01-01|2026-01-01': [{ name: 'Alice', githubHandleArray: ['alice'], contributions: 700 }],
  });

  await enrichWithAttribution(contributors, '2024-01-01', '2026-01-01', affiliations, {
    apiGet: mockGet, apiSleep: noopSleep,
  });

  const attr = contributors.data[0].attributedContributions;
  assert.equal(attr.length, 2);
  assert.equal(attr[0].company, 'OldCo');
  assert.equal(attr[0].contributions, 500);
  assert.equal(attr[0].method, 'actual');
  assert.equal(attr[0].from, '2024-01-01');
  assert.equal(attr[0].until, '2025-01-01');
  assert.equal(attr[1].company, 'NewCo');
  assert.equal(attr[1].contributions, 700);
  assert.equal(attr[1].method, 'actual');
  assert.equal(attr[1].from, '2025-01-01');
  assert.equal(attr[1].until, '2026-01-01');
});

test('enrichWithAttribution: top-N contributor not found in sub-period falls back to proportional', async () => {
  const contributors = {
    data: [
      { name: 'Bob', githubHandleArray: ['bob'], contributions: 1000, percentage: 1.0 },
    ],
  };
  const affiliations = makeAffiliations('bob', [
    { company: 'A', from: null,         until: '2025-01-01' },
    { company: 'B', from: '2025-01-01', until: null         },
  ]);
  const mockGet = makeMockGet({}); // returns empty for all sub-periods

  await enrichWithAttribution(contributors, '2024-01-01', '2026-01-01', affiliations, {
    apiGet: mockGet, apiSleep: noopSleep,
  });

  const attr = contributors.data[0].attributedContributions;
  assert.equal(attr.length, 2);
  assert.equal(attr[0].method, 'proportional');
  assert.equal(attr[1].method, 'proportional');
  // 2024 is a leap year: 366 days in first half (2024-01-01 to 2025-01-01), 365 in second
  const total = daysBetween('2024-01-01', '2026-01-01');
  const days0 = daysBetween('2024-01-01', '2025-01-01');
  assert.equal(attr[0].contributions, Math.round(1000 * (days0 / total)));
});

test('enrichWithAttribution: single-company contributor is untouched', async () => {
  const contributors = {
    data: [
      { name: 'Carol', githubHandleArray: ['carol'], contributions: 800, percentage: 0.5 },
    ],
  };
  const affiliations = makeAffiliations('carol', [
    { company: 'StableCo', from: '2020-01-01', until: null },
  ]);
  const mockGet = makeMockGet({});

  await enrichWithAttribution(contributors, '2024-01-01', '2026-01-01', affiliations, {
    apiGet: mockGet, apiSleep: noopSleep,
  });

  assert.equal(contributors.data[0].attributedContributions, undefined);
});

test('enrichWithAttribution: contributor with no affiliations entry is untouched', async () => {
  const contributors = {
    data: [
      { name: 'Dave', githubHandleArray: ['dave'], contributions: 500, percentage: 0.3 },
    ],
  };
  await enrichWithAttribution(contributors, '2024-01-01', '2026-01-01', {}, {
    apiGet: makeMockGet({}), apiSleep: noopSleep,
  });

  assert.equal(contributors.data[0].attributedContributions, undefined);
});

test('enrichWithAttribution: rest (rank 101+) split contributor gets proportional', async () => {
  // Fill top-100 with stub contributors so our target is at rank 101
  const top100 = Array.from({ length: TOP_N }, (_, i) => ({
    name: `Stub ${i}`, githubHandleArray: [`stub${i}`], contributions: 9999, percentage: 0.1,
  }));
  const target = { name: 'Eve', githubHandleArray: ['eve'], contributions: 600, percentage: 0.1 };
  const contributors = { data: [...top100, target] };

  const affiliations = makeAffiliations('eve', [
    { company: 'X', from: null,         until: '2025-01-01' },
    { company: 'Y', from: '2025-01-01', until: null         },
  ]);
  const apiCallLog = [];
  const mockGet = async (path, params) => {
    apiCallLog.push(params.startDate);
    return { meta: { total: 0 }, data: [] };
  };

  await enrichWithAttribution(contributors, '2024-01-01', '2026-01-01', affiliations, {
    apiGet: mockGet, apiSleep: noopSleep,
  });

  // Sub-period API calls happen only for top-100 splits — none of the stubs have affiliations
  // so no API calls should have been made (no split contributors in top-100).
  assert.equal(apiCallLog.length, 0);

  const attr = target.attributedContributions;
  assert.equal(attr.length, 2);
  assert.equal(attr[0].company, 'X');
  assert.equal(attr[0].method, 'proportional');
  assert.equal(attr[1].company, 'Y');
  assert.equal(attr[1].method, 'proportional');
  assert.equal(attr[0].contributions + attr[1].contributions, 600); // may be off by 1 due to rounding
});

test('enrichWithAttribution: three-way split produces correct sub-windows', async () => {
  const contributors = {
    data: [
      { name: 'Frank', githubHandleArray: ['frank'], contributions: 3000, percentage: 1.0 },
    ],
  };
  const affiliations = makeAffiliations('frank', [
    { company: 'A', from: null,         until: '2024-06-01' },
    { company: 'B', from: '2024-06-01', until: '2025-06-01' },
    { company: 'C', from: '2025-06-01', until: null         },
  ]);
  const mockGet = makeMockGet({
    '2024-01-01|2024-06-01': [{ name: 'Frank', githubHandleArray: ['frank'], contributions: 600  }],
    '2024-06-01|2025-06-01': [{ name: 'Frank', githubHandleArray: ['frank'], contributions: 1400 }],
    '2025-06-01|2026-01-01': [{ name: 'Frank', githubHandleArray: ['frank'], contributions: 1000 }],
  });

  await enrichWithAttribution(contributors, '2024-01-01', '2026-01-01', affiliations, {
    apiGet: mockGet, apiSleep: noopSleep,
  });

  const attr = contributors.data[0].attributedContributions;
  assert.equal(attr.length, 3);
  assert.equal(attr[0].company, 'A');  assert.equal(attr[0].contributions, 600);
  assert.equal(attr[1].company, 'B');  assert.equal(attr[1].contributions, 1400);
  assert.equal(attr[2].company, 'C');  assert.equal(attr[2].contributions, 1000);
  assert.ok(attr.every(a => a.method === 'actual'));
});
