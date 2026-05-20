#!/usr/bin/env node
// Fetches GitHub profile company for contributors not covered by gitdm.
// Uses `gh auth token` for authentication (5000 req/hr).
// Saves incrementally to data/github-companies.json — safe to resume.
//
// Covers contributors from ALL time periods (not just 1y) so that
// contributors active only in 2y/3y/all views also get company data.
// Null entries are cleared each run so recently-updated profiles are
// picked up on the next weekly refresh.

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, '../data/cache.json');
const GITDM_PATH = join(__dirname, '../data/affiliations.json');
const OUT_PATH   = join(__dirname, '../data/github-companies.json');

// ms to wait between requests — stay well under secondary rate limit
const DELAY_MS = 100;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try { return execSync('gh auth token', { encoding: 'utf8' }).trim(); }
  catch { throw new Error('No GitHub token found — set GITHUB_TOKEN or run: gh auth login'); }
}

async function fetchGitHubCompany(handle, token, retries = 3) {
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) {
    if (retries <= 0) throw new Error(`Rate limited — giving up on ${handle} after retries`);
    const reset = res.headers.get('x-ratelimit-reset');
    const wait  = reset ? (Number(reset) * 1000 - Date.now() + 2000) : 60_000;
    console.log(`  Rate limited — waiting ${Math.ceil(wait/1000)}s…`);
    await sleep(wait);
    return fetchGitHubCompany(handle, token, retries - 1);
  }
  if (!res.ok) return null;

  const data = await res.json();
  const raw  = (data.company || '').trim().replace(/^@/, '').trim();
  return raw || null;
}

async function main() {
  const token     = getToken();
  const cache     = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  const gitdm     = JSON.parse(readFileSync(GITDM_PATH, 'utf8'));
  const existing  = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : {};

  // Clear previously-null entries so contributors who have since set a company
  // on their GitHub profile are picked up on this run.
  let clearedNulls = 0;
  for (const handle of Object.keys(existing)) {
    if (existing[handle] === null) {
      delete existing[handle];
      clearedNulls++;
    }
  }
  if (clearedNulls > 0) console.log(`Cleared ${clearedNulls} stale null entries for re-fetch`);

  // Collect unique contributors across ALL periods so that contributors
  // active only in 2y/3y/all views also get company data.
  const contribMap = new Map(); // primary handle (lowercase) → contributor
  for (const period of Object.values(cache.periods || {})) {
    for (const c of period.contributors?.data ?? []) {
      const primary = (c.githubHandleArray || [])[0]?.toLowerCase();
      if (primary && !contribMap.has(primary)) contribMap.set(primary, c);
    }
  }

  const toFetch = [];
  for (const c of contribMap.values()) {
    const handles = c.githubHandleArray || [];
    const hasGitdm = handles.some(h => gitdm[h.toLowerCase()]);
    if (hasGitdm) continue;

    // Pick first handle not yet fetched (null means "fetched, no company")
    const handle = handles.find(h => !(h.toLowerCase() in existing));
    if (handle) toFetch.push(handle.toLowerCase());
  }

  console.log(`${toFetch.length} handles to fetch (${Object.keys(existing).length} already cached, from ${contribMap.size} unique contributors across all periods)`);

  let fetched = 0, found = 0;
  for (const handle of toFetch) {
    const company = await fetchGitHubCompany(handle, token);
    existing[handle] = company; // null = no company, still record to skip next run
    fetched++;
    if (company) {
      found++;
      console.log(`  ${handle} -> ${company}`);
    }

    // Save every 50 requests
    if (fetched % 50 === 0) {
      writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2));
      const remaining = toFetch.length - fetched;
      console.log(`[${fetched}/${toFetch.length}] saved — ${found} companies found so far, ~${remaining} remaining`);
    }

    await sleep(DELAY_MS);
  }

  writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2));
  console.log(`\nDone. ${found}/${fetched} handles had a company set.`);
  console.log(`Saved to ${OUT_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
