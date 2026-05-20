#!/usr/bin/env node
/**
 * Fetches per-SIG (per-repository) contributor and organization data from LF Insights.
 *
 * For each non-archived repo in the open-telemetry GitHub org, fetches:
 *   - Full contributor leaderboard (all pages)
 *   - Full organization leaderboard (all pages)
 *
 * Across all 7 time presets: 30d, 90d, 6m, 1y, 2y, 3y, all
 *
 * Short presets (30d–1y) always refresh. Long presets (2y, 3y, all) are
 * skipped if data/sigs.json was already fetched within the last 7 days.
 *
 * Usage:
 *   node scripts/fetch-sigs.mjs           # smart refresh
 *   node scripts/fetch-sigs.mjs --full    # force-refresh everything
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

const BASE       = 'https://insights.linuxfoundation.org/api/project/opentelemetry';
const GH_API     = 'https://api.github.com';
const CACHE_PATH = 'data/sigs.json';
const FULL       = process.argv.includes('--full');
const GH_TOKEN   = process.env.GITHUB_TOKEN;

const endDate = new Date().toISOString().split('T')[0];

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

const PERIODS = [
  { key: '30d', startDate: daysAgo(30),   alwaysRefresh: true  },
  { key: '90d', startDate: daysAgo(90),   alwaysRefresh: true  },
  { key: '6m',  startDate: daysAgo(182),  alwaysRefresh: true  },
  { key: '1y',  startDate: daysAgo(365),  alwaysRefresh: true  },
  { key: '2y',  startDate: daysAgo(730),  alwaysRefresh: false },
  { key: '3y',  startDate: daysAgo(1095), alwaysRefresh: false },
  { key: 'all', startDate: '2019-01-01',  alwaysRefresh: false },
];

// ── Concurrency helpers ──────────────────────────────────────────────
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

// ── Load existing cache ──────────────────────────────────────────────
function loadExistingCache() {
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf8')); } catch { return null; }
}

function ageDays(isoDate) {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
}

// ── HTTP helpers ─────────────────────────────────────────────────────
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
    if (offset < total) await sleep(150);
  }
  return { total, data: all };
}

// ── GitHub repo list ─────────────────────────────────────────────────
async function fetchNonArchivedRepos() {
  const headers = GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {};
  const repos = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${GH_API}/orgs/open-telemetry/repos?per_page=100&type=public&page=${page}`,
      { headers }
    );
    if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
    const data = await res.json();
    if (!data.length) break;
    repos.push(...data.filter(r => !r.archived).map(r => r.name));
    if (data.length < 100) break;
    page++;
  }
  return repos.sort();
}

// ── Per-repo SIG data fetch ──────────────────────────────────────────
async function fetchSigData(repoName, startDate) {
  const repoUrl = `https://github.com/open-telemetry/${repoName}`;
  const p = {
    startDate, endDate,
    platform: 'all', activityType: 'all',
    repos: repoUrl,
    includeCollaborations: false,
  };

  const contributors  = await getAll('contributors/contributor-leaderboard',  p);
  await sleep(100);
  const organizations = await getAll('contributors/organization-leaderboard', p);

  return { contributors, organizations };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nFetching OTel SIG data${FULL ? ' (full refresh)' : ''}\n`);
  mkdirSync('data', { recursive: true });

  const existing = loadExistingCache();
  const periods  = existing?.periods ? { ...existing.periods } : {};
  const cacheAge = ageDays(existing?.fetchedAt);

  console.log('── Fetching non-archived repo list from GitHub…');
  const repos = await fetchNonArchivedRepos();
  console.log(`   ✓ ${repos.length} repos\n`);

  for (const { key, startDate, alwaysRefresh } of PERIODS) {
    const skip = !FULL && !alwaysRefresh && cacheAge < 7;

    if (skip) {
      console.log(`── ${key}  skipped (cache is ${cacheAge.toFixed(1)}d old)`);
      continue;
    }

    console.log(`\n── ${key}  (${startDate} → ${endDate})`);
    periods[key] = {};

    let succeeded = 0, skipped = 0, errored = 0;

    await withConcurrency(repos, 3, async (repo, i) => {
      try {
        periods[key][repo] = await fetchSigData(repo, startDate);
        succeeded++;
        process.stdout.write(`\r  [${(succeeded + skipped + errored).toString().padStart(2)}/${repos.length}] ${repo.padEnd(55)}`);
      } catch (e) {
        const isNotFound = e.message.includes('HTTP 404');
        if (isNotFound) {
          // No LFX data for this repo — normal, store as empty
          periods[key][repo] = { contributors: { total: 0, data: [] }, organizations: { total: 0, data: [] } };
          skipped++;
        } else {
          // Operational error (rate limit, auth, network) — log and preserve cached data
          process.stdout.write('\n');
          console.log(`  ✗ ${repo}: ${e.message}`);
          periods[key][repo] = existing?.periods?.[key]?.[repo]
            ?? { contributors: { total: 0, data: [] }, organizations: { total: 0, data: [] } };
          errored++;
        }
      }
    });

    process.stdout.write('\n');
    console.log(`  ✓ ${succeeded} fetched, ${skipped} empty, ${errored} errors`);
  }

  const cache  = { fetchedAt: new Date().toISOString(), repos, periods };
  const json   = JSON.stringify(cache);
  const sizeKB = (json.length / 1024).toFixed(0);
  writeFileSync(CACHE_PATH, json);
  console.log(`\n✓ Saved ${CACHE_PATH}  (${sizeKB} KB)\n`);
}

main().catch(e => { console.error('\nFetch failed:', e.message); process.exit(1); });
