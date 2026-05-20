#!/usr/bin/env node
/**
 * Fetches OpenTelemetry contribution data from LF Insights API.
 *
 * Two cache layers:
 *   periods      — full data (all contributors paginated) for all×all filter, 7 presets
 *   filterCombos — summary + top-25 contributors + top-15 orgs for every
 *                  platform × activityType combination, per preset
 *
 * Per-repo contributor breakdowns are derived from data/sigs.json (fetch-sigs.mjs)
 * rather than being fetched here, so both the contributor panel and SIG modal
 * always use the same data source.
 *
 * Short presets (30d–1y) always refresh. Long presets (2y, 3y, all) are
 * skipped if already cached within the last 7 days.
 *
 * Usage:
 *   node scripts/fetch-data.mjs           # smart refresh
 *   node scripts/fetch-data.mjs --full    # force-refresh everything
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

const BASE       = 'https://insights.linuxfoundation.org/api/project/opentelemetry';
const CACHE_PATH = 'data/cache.json';
const FULL       = process.argv.includes('--full');

const endDate = new Date().toISOString().split('T')[0];

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

const PERIODS = [
  { key: '30d', startDate: daysAgo(30),   prevStartDate: daysAgo(60),   alwaysRefresh: true  },
  { key: '90d', startDate: daysAgo(90),   prevStartDate: daysAgo(180),  alwaysRefresh: true  },
  { key: '6m',  startDate: daysAgo(182),  prevStartDate: daysAgo(364),  alwaysRefresh: true  },
  { key: '1y',  startDate: daysAgo(365),  prevStartDate: daysAgo(730),  alwaysRefresh: true  },
  { key: '2y',  startDate: daysAgo(730),  prevStartDate: daysAgo(1460), alwaysRefresh: false },
  { key: '3y',  startDate: daysAgo(1095), prevStartDate: daysAgo(2190), alwaysRefresh: false },
  { key: 'all', startDate: '2019-01-01',  prevStartDate: null,          alwaysRefresh: false },
];

// 'all' is handled by fetchPeriod (full pagination); others are filter combos.
const PLATFORMS = ['github', 'git', 'gerrit', 'gitlab', 'confluence', 'jira'];

// ── Concurrency helpers ──────────────────────────────────────────
async function withConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ── Load existing cache ──────────────────────────────────────────
function loadExistingCache() {
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf8')); } catch { return null; }
}

function ageDays(isoDate) {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
}

// ── HTTP helpers ─────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(path, params = {}) {
  const qs  = new URLSearchParams(params);
  const url = `${BASE}/${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — GET ${path}`);
  return res.json();
}

async function getAll(path, params = {}) {
  const LIMIT = 200;
  let offset = 0, total = Infinity;
  const all = [];
  while (offset < total) {
    const d = await get(path, { ...params, limit: LIMIT, offset });
    all.push(...(d.data ?? []));
    total  = d.meta?.total ?? all.length;
    offset += LIMIT;
    process.stdout.write(`\r  ${all.length} / ${total}`);
    if (offset < total) await sleep(150);
  }
  process.stdout.write('\n');
  return { total, data: all };
}

// ── Previous-period leaderboards ────────────────────────────────
async function fetchPrevLeaderboards(fromDate, toDate, platform = 'all') {
  const p = { startDate: fromDate, endDate: toDate, platform, activityType: 'all' };
  const [contributors, organizations] = await Promise.all([
    getAll('contributors/contributor-leaderboard', p),
    getAll('contributors/organization-leaderboard', p),
  ]);
  return { contributors, organizations };
}

function applyPrevContributions(contributors, organizations, prev) {
  // Use max to handle duplicate names the API sometimes returns across pages.
  const pc = new Map();
  prev.contributors.data.forEach(c => pc.set(c.name, Math.max(pc.get(c.name) ?? 0, c.contributions)));
  const po = new Map();
  prev.organizations.data.forEach(o => po.set(o.name, Math.max(po.get(o.name) ?? 0, o.contributions)));
  contributors.data  = contributors.data.map(c  => ({ ...c,  previousContributions: pc.get(c.name)  ?? 0 }));
  organizations.data = organizations.data.map(o => ({ ...o, previousContributions: po.get(o.name) ?? 0 }));
}

// ── Full period fetch ────────────────────────────────────────────
async function fetchPeriod(startDate, prevStartDate = null) {
  const p = { startDate, endDate, platform: 'all', activityType: 'all' };

  console.log('  Summary…');
  const [activeContributors, activeOrganizations, contributorDependency,
         organizationDependency, geographicalDistribution] = await Promise.all([
    get('contributors/active-contributors', p),
    get('contributors/active-organizations', p),
    get('contributors/contributor-dependency', p),
    get('contributors/organization-dependency', p),
    get('contributors/geographical-distribution', p),
  ]);

  console.log('  Contributor leaderboard…');
  const contributors = await getAll('contributors/contributor-leaderboard', p);
  console.log(`  ✓ ${contributors.data.length} contributors`);

  console.log('  Organization leaderboard…');
  const organizations = await getAll('contributors/organization-leaderboard', p);
  console.log(`  ✓ ${organizations.data.length} organizations`);

  if (prevStartDate) {
    console.log('  Previous period leaderboards…');
    const prev = await fetchPrevLeaderboards(prevStartDate, startDate);
    applyPrevContributions(contributors, organizations, prev);
  }

  return { period: { startDate, endDate },
    activeContributors, activeOrganizations, contributorDependency,
    organizationDependency, geographicalDistribution, contributors, organizations };
}

// ── Filter combo fetch ───────────────────────────────────────────
async function fetchFilterCombo(startDate, platform, prevStartDate = null) {
  const p = { startDate, endDate, platform, activityType: 'all' };

  const [activeContributors, activeOrganizations, contributorDependency,
         organizationDependency, geographicalDistribution] = await Promise.all([
    get('contributors/active-contributors', p),
    get('contributors/active-organizations', p),
    get('contributors/contributor-dependency', p),
    get('contributors/organization-dependency', p),
    get('contributors/geographical-distribution', p),
  ]);

  const contributors  = await getAll('contributors/contributor-leaderboard',  p);
  const organizations = await getAll('contributors/organization-leaderboard', p);

  if (prevStartDate) {
    const prev = await fetchPrevLeaderboards(prevStartDate, startDate, platform);
    applyPrevContributions(contributors, organizations, prev);
  }

  return {
    period: { startDate, endDate },
    activeContributors, activeOrganizations, contributorDependency,
    organizationDependency, geographicalDistribution,
    contributors, organizations,
  };
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log(`\nFetching OTel contributions${FULL ? ' (full refresh)' : ''}\n`);
  mkdirSync('data', { recursive: true });

  const existing     = loadExistingCache();
  const periods      = existing?.periods      ? { ...existing.periods }      : {};
  const filterCombos = existing?.filterCombos ? { ...existing.filterCombos } : {};

  // ── Full periods (all×all) ────────────────────────────────────
  for (const { key, startDate, prevStartDate, alwaysRefresh } of PERIODS) {
    const cached  = existing?.periods?.[key];
    const old     = ageDays(cached?.period?.endDate);
    const skip    = !FULL && !alwaysRefresh && old < 7;

    if (skip) {
      console.log(`── ${key}  periods skipped (cached ${old.toFixed(1)}d ago)`);
    } else {
      console.log(`\n── ${key}  (${startDate} → ${endDate})`);
      try {
        periods[key] = await fetchPeriod(startDate, prevStartDate);
      } catch (e) {
        console.error(`  ✗ ${key} period fetch failed: ${e.message}`);
        if (existing?.periods?.[key]) {
          periods[key] = existing.periods[key];
          console.warn(`    ↳ kept cached data`);
        }
      }
      await sleep(300);
    }
  }

  // ── Filter combos ─────────────────────────────────────────────
  console.log('\n── Filter combinations (summary + top-N)\n');

  for (const { key, startDate, prevStartDate, alwaysRefresh } of PERIODS) {
    const combosCached = existing?.filterCombos?.[key];
    const anyComboDate = combosCached ? Object.values(combosCached)[0]?.period?.endDate : null;
    const old          = ageDays(anyComboDate);
    const skipPeriod   = !FULL && !alwaysRefresh && old < 7;

    if (skipPeriod) {
      console.log(`  ${key}  combos skipped (cached ${old.toFixed(1)}d ago)`);
      continue;
    }

    filterCombos[key] = { ...(existing?.filterCombos?.[key] ?? {}) };

    await withConcurrency(PLATFORMS, 3, async platform => {
      try {
        const data = await fetchFilterCombo(startDate, platform, prevStartDate);
        filterCombos[key][platform] = data;
        console.log(`  ${key}  platform=${platform.padEnd(12)} ✓`);
      } catch (e) {
        console.error(`  ${key}  platform=${platform.padEnd(12)} ✗  ${e.message}`);
        if (existing?.filterCombos?.[key]?.[platform]) {
          filterCombos[key][platform] = existing.filterCombos[key][platform];
          console.warn(`    ↳ kept cached data`);
        }
      }
    });
  }

  // ── Write output ──────────────────────────────────────────────
  const cache  = { fetchedAt: new Date().toISOString(), periods, filterCombos };
  const json   = JSON.stringify(cache);
  const sizeKB = (json.length / 1024).toFixed(0);
  writeFileSync(CACHE_PATH, json);
  console.log(`\n✓ Saved ${CACHE_PATH}  (${sizeKB} KB)\n`);
}

main().catch(e => { console.error('\nFetch failed:', e.message); process.exit(1); });
