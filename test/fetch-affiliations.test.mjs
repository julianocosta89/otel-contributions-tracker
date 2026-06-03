import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAffiliations, allRanges, activeCompany } from '../scripts/fetch-affiliations.mjs';

// ── allRanges ────────────────────────────────────────────────────────────────

test('allRanges: parses single open-ended entry', () => {
  const lines = [{ text: 'Grafana Labs from 2025-05-02', lineNum: 2 }];
  const ranges = allRanges(lines);
  assert.deepEqual(ranges, [
    { company: 'Grafana Labs', from: '2025-05-02', until: null },
  ]);
});

test('allRanges: parses entry with both from and until', () => {
  const lines = [{ text: 'Just Eat from 2016-01-01 until 2025-05-02', lineNum: 3 }];
  const ranges = allRanges(lines);
  assert.deepEqual(ranges, [
    { company: 'Just Eat', from: '2016-01-01', until: '2025-05-02' },
  ]);
});

test('allRanges: parses entry with only until', () => {
  const lines = [{ text: 'Experian Information Solutions Inc. until 2016-01-01', lineNum: 2 }];
  const ranges = allRanges(lines);
  assert.deepEqual(ranges, [
    { company: 'Experian Information Solutions Inc.', from: null, until: '2016-01-01' },
  ]);
});

test('allRanges: preserves file order for multiple ranges', () => {
  const lines = [
    { text: 'Experian Information Solutions Inc. until 2016-01-01', lineNum: 2 },
    { text: 'Just Eat from 2016-01-01 until 2025-05-02',            lineNum: 3 },
    { text: 'Grafana Labs from 2025-05-02',                          lineNum: 4 },
  ];
  const ranges = allRanges(lines);
  assert.equal(ranges.length, 3);
  assert.equal(ranges[0].company, 'Experian Information Solutions Inc.');
  assert.equal(ranges[1].company, 'Just Eat');
  assert.equal(ranges[2].company, 'Grafana Labs');
});

// ── activeCompany ────────────────────────────────────────────────────────────

test('activeCompany: returns company with no until date', () => {
  const lines = [{ text: 'Grafana Labs from 2025-05-02', lineNum: 2 }];
  assert.equal(activeCompany(lines), 'Grafana Labs');
});

test('activeCompany: returns null when all entries have past until dates', () => {
  const lines = [
    { text: 'Old Corp until 2010-01-01', lineNum: 2 },
    { text: 'Another Corp from 2010-01-01 until 2015-06-01', lineNum: 3 },
  ];
  assert.equal(activeCompany(lines), null);
});

test('activeCompany: picks latest from date when multiple active', () => {
  const lines = [
    { text: 'Company A from 2020-01-01', lineNum: 2 },
    { text: 'Company B from 2023-06-01', lineNum: 3 },
  ];
  assert.equal(activeCompany(lines), 'Company B');
});

test('activeCompany: no-from entry loses to any entry with a from date', () => {
  const lines = [
    { text: 'Old Company',                lineNum: 2 },
    { text: 'New Company from 2022-01-01', lineNum: 3 },
  ];
  assert.equal(activeCompany(lines), 'New Company');
});

// ── parseAffiliations ────────────────────────────────────────────────────────

const SAMPLE = `martincostello: martin@example.com
\tExperian Information Solutions Inc. until 2016-01-01
\tJust Eat from 2016-01-01 until 2025-05-02
\tGrafana Labs from 2025-05-02
trask: trask@example.com
\tSplunk
nocompany: nc@example.com
\tOld Firm until 2010-01-01
`;

test('parseAffiliations: stores all three ranges for martincostello', () => {
  const map = parseAffiliations(SAMPLE, 7);
  const entry = map['martincostello'];
  assert.ok(entry, 'entry should exist');
  assert.equal(entry.ranges.length, 3);
  assert.equal(entry.ranges[0].company, 'Experian Information Solutions Inc.');
  assert.equal(entry.ranges[1].company, 'Just Eat');
  assert.equal(entry.ranges[2].company, 'Grafana Labs');
});

test('parseAffiliations: active company is Grafana Labs', () => {
  const map = parseAffiliations(SAMPLE, 7);
  assert.equal(map['martincostello'].company, 'Grafana Labs');
});

test('parseAffiliations: lineStart points to handle line', () => {
  const map = parseAffiliations(SAMPLE, 7);
  assert.equal(map['martincostello'].lineStart, 1);
  assert.equal(map['martincostello'].line, 1); // backward compat alias
});

test('parseAffiliations: lineEnd points to last affiliation line', () => {
  const map = parseAffiliations(SAMPLE, 7);
  assert.equal(map['martincostello'].lineEnd, 4);
});

test('parseAffiliations: stores file number', () => {
  const map = parseAffiliations(SAMPLE, 7);
  assert.equal(map['martincostello'].file, 7);
});

test('parseAffiliations: single-range contributor stored correctly', () => {
  const map = parseAffiliations(SAMPLE, 7);
  const entry = map['trask'];
  assert.ok(entry);
  assert.equal(entry.company, 'Splunk');
  assert.equal(entry.ranges.length, 1);
  assert.deepEqual(entry.ranges[0], { company: 'Splunk', from: null, until: null });
});

test('parseAffiliations: contributor with no active company is excluded', () => {
  const map = parseAffiliations(SAMPLE, 7);
  assert.equal(map['nocompany'], undefined);
});

test('parseAffiliations: handle is lowercased', () => {
  const text = `MixedCase: mc@example.com\n\tSome Corp\n`;
  const map = parseAffiliations(text, 1);
  assert.ok(map['mixedcase']);
  assert.equal(map['MixedCase'], undefined);
});
