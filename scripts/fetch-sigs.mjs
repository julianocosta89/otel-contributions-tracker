#!/usr/bin/env node
/**
 * Fetches per-SIG (per-repository) contributor and organization data from LF Insights.
 *
 * For each non-archived repo in the open-telemetry GitHub org, fetches:
 *   - Full contributor leaderboard (all pages)
 *   - Full organization leaderboard (all pages)
 *
 * Across all 8 time presets: 30d, 60d, 90d, 6m, 1y, 2y, 3y, all
 *
 * Short presets (30d–1y) always refresh. Long presets (2y, 3y, all) are
 * skipped if data/sigs.json was already fetched within the last 7 days.
 *
 * Usage:
 *   node scripts/fetch-sigs.mjs           # smart refresh
 *   node scripts/fetch-sigs.mjs --full    # force-refresh everything
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE       = 'https://insights.linuxfoundation.org/api/widget';
const PROJECT    = 'opentelemetry';
const GH_API     = 'https://api.github.com';
const CACHE_PATH = 'data/sigs.json';
const FULL       = process.argv.includes('--full');
const GH_TOKEN   = process.env.GITHUB_TOKEN;

const endDate = new Date().toISOString().split('T')[0];

const EMPTY_REPO = { contributors: { total: 0, data: [] }, organizations: { total: 0, data: [] } };

// A cached entry is only a genuine "last known good" fallback if it actually has
// data — an EMPTY_REPO-shaped stub (e.g. left over from a prior outage) is no
// better than having no cache at all and must not be reported as one.
export function isUsableCache(entry) {
  return !!entry && (entry.contributors?.total > 0 || entry.organizations?.total > 0);
}

// A 404 on one repo legitimately means "no LFX data for this repo" — but if the
// vast majority of repos 404 in the same run, that means the LF Insights API
// itself is down or its route shape changed, not that every repo lost its
// history simultaneously.
export function isSuspectedOutage(notFoundCount, totalCount) {
  return totalCount > 0 && notFoundCount > totalCount * 0.5;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

const PERIODS = [
  { key: '30d', startDate: daysAgo(30),   alwaysRefresh: true  },
  { key: '60d', startDate: daysAgo(60),   alwaysRefresh: true  },
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
  const qs  = new URLSearchParams({ project: PROJECT, ...params });
  const url = `${BASE}/${path}?${qs}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    // 429/503 are transient (rate limiting / brief upstream unavailability) —
    // retry a couple of times before treating it as an operational error.
    if ((res.status === 429 || res.status === 503) && attempt < 2) {
      await sleep(500 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${res.status} — GET ${path}`);
  }
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

  const runStartedAt   = new Date().toISOString();
  const existing       = loadExistingCache();
  const periods        = existing?.periods ? { ...existing.periods } : {};
  const sources        = existing?.sources
    ? JSON.parse(JSON.stringify(existing.sources))
    : { repos: null, periods: {} };
  sources.periods ??= {};
  let   totalHardFails = 0; // non-404 errors with no cached fallback

  console.log('── Fetching non-archived repo list from GitHub…');
  const repos = await fetchNonArchivedRepos();
  sources.repos = { fetchedAt: runStartedAt, status: 'fresh' };
  console.log(`   ✓ ${repos.length} repos\n`);

  for (const { key, startDate, alwaysRefresh } of PERIODS) {
    const source = sources.periods[key];
    const cacheAge = ageDays(source?.fetchedAt);
    const skip = !FULL && !alwaysRefresh && source && cacheAge < 7;

    if (skip) {
      console.log(`── ${key}  skipped (cache is ${cacheAge.toFixed(1)}d old)`);
      continue;
    }

    console.log(`\n── ${key}  (${startDate} → ${endDate})`);
    periods[key] = {};

    let succeeded = 0, errored = 0;
    const notFoundRepos = [];
    const fallbackRepos = [];
    const errors = {};
    const results = {};

    await withConcurrency(repos, 3, async (repo, i) => {
      try {
        results[repo] = await fetchSigData(repo, startDate);
        succeeded++;
        process.stdout.write(`\r  [${(succeeded + notFoundRepos.length + errored).toString().padStart(2)}/${repos.length}] ${repo.padEnd(55)}`);
      } catch (e) {
        const isNotFound = e.message.includes('HTTP 404');
        if (isNotFound) {
          notFoundRepos.push(repo);
        } else {
          // Operational error (rate limit, auth, network) — log and preserve cached data
          process.stdout.write('\n');
          console.log(`  ✗ ${repo}: ${e.message}`);
          const cached = existing?.periods?.[key]?.[repo];
          const usable = isUsableCache(cached);
          periods[key][repo] = usable ? cached : EMPTY_REPO;
          if (usable) {
            fallbackRepos.push(repo);
            errors[repo] = e.message;
          } else {
            totalHardFails++;
          }
          errored++;
        }
      }
    });

    process.stdout.write('\n');

    // Treat a suspected outage like any other operational error (preserve cached
    // data) instead of overwriting everything with empty stubs.
    const suspectedOutage = isSuspectedOutage(notFoundRepos.length, repos.length);
    for (const repo of notFoundRepos) {
      if (suspectedOutage) {
        const cached = existing?.periods?.[key]?.[repo];
        const usable = isUsableCache(cached);
        periods[key][repo] = usable ? cached : EMPTY_REPO;
        if (usable) {
          fallbackRepos.push(repo);
          errors[repo] = 'HTTP 404 — suspected LF Insights outage (most repos 404\'d this run)';
        } else {
          totalHardFails++;
        }
        errored++;
      } else {
        periods[key][repo] = EMPTY_REPO;
      }
    }
    for (const repo of repos) periods[key][repo] ??= results[repo];

    if (suspectedOutage) {
      console.log(`  ⚠ ${notFoundRepos.length}/${repos.length} repos 404'd — suspected LF Insights outage, falling back to cache`);
    }
    console.log(`  ✓ ${succeeded} fetched, ${suspectedOutage ? 0 : notFoundRepos.length} empty, ${errored} errors`);
    sources.periods[key] = fallbackRepos.length
      ? {
          fetchedAt: runStartedAt,
          status: 'partial',
          fallbackFrom: source?.fetchedAt ?? existing?.fetchedAt ?? null,
          fallbackRepos,
          errors,
        }
      : { fetchedAt: runStartedAt, status: 'fresh' };
  }

  if (totalHardFails > 0) {
    console.error(`\n✗ ${totalHardFails} repo(s) failed with no cached fallback — leaving cache unchanged`);
    process.exit(1);
  }

  const cache  = { fetchedAt: runStartedAt, sources, repos, periods };
  const json   = JSON.stringify(cache);
  const sizeKB = (json.length / 1024).toFixed(0);
  writeFileSync(CACHE_PATH, json);
  console.log(`\n✓ Saved ${CACHE_PATH}  (${sizeKB} KB)\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error('\nFetch failed:', e.message); process.exit(1); });
}
