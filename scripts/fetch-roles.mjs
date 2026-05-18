#!/usr/bin/env node
/**
 * Fetches GitHub team memberships for the open-telemetry org and maps
 * them to contribution roles.
 *
 * Team slug patterns → role:
 *   *-maintainers   → maintainer
 *   *-approvers     → approver
 *   *-contributors  → code-owner
 *   *-triagers      → triager
 *
 * Hierarchy (highest wins per contributor):
 *   maintainer (4) > approver (3) > code-owner (2) > triager (1)
 *
 * Output: data/roles.json
 *   { fetchedAt, roles: { githubHandle: { role: "maintainer" | "approver" | "code-owner" | "triager", teams: string[] } } }
 *
 * Usage:
 *   node scripts/fetch-roles.mjs
 *
 * Requires GITHUB_TOKEN env var with read:org scope.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

const GH_API    = 'https://api.github.com';
const ORG       = 'open-telemetry';
const OUT_PATH  = 'data/roles.json';
const GH_TOKEN  = process.env.GITHUB_TOKEN;

if (!GH_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required (needs read:org scope).');
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${GH_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const ROLE_RANK = { maintainer: 4, approver: 3, 'code-owner': 2, triager: 1 };

const SLUG_SUFFIXES = [
  { suffix: '-maintainers',  role: 'maintainer'  },
  { suffix: '-approvers',    role: 'approver'     },
  { suffix: '-contributors', role: 'code-owner'   },
  { suffix: '-triagers',     role: 'triager'      },
];

function roleForSlug(slug) {
  for (const { suffix, role } of SLUG_SUFFIXES) {
    if (slug.endsWith(suffix)) return role;
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ghGet(path) {
  const res = await fetch(`${GH_API}${path}`, { headers: HEADERS });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status} — GET ${path}`);
  return res.json();
}

async function ghGetAll(path) {
  const all = [];
  let page = 1;
  while (true) {
    const sep  = path.includes('?') ? '&' : '?';
    const data = await ghGet(`${path}${sep}per_page=100&page=${page}`);
    if (!data.length) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
    await sleep(120);
  }
  return all;
}

async function main() {
  console.log(`\nFetching OTel GitHub team roles\n`);
  mkdirSync('data', { recursive: true });

  // ── 1. List all org teams ──────────────────────────────────────────
  console.log('── Fetching org teams…');
  const allTeams = await ghGetAll(`/orgs/${ORG}/teams`);
  console.log(`   ${allTeams.length} teams found`);

  // ── 2. Filter to role-relevant teams ──────────────────────────────
  const roleTeams = allTeams
    .map(t => ({ slug: t.slug, role: roleForSlug(t.slug) }))
    .filter(t => t.role !== null);

  console.log(`   ${roleTeams.length} role teams to process\n`);

  // ── 3. Fetch members per team, apply hierarchy ─────────────────────
  const roles = {}; // handle (lowercase) → { role, teams: string[] }

  function applyRole(handle, role, slug) {
    const h    = handle.toLowerCase();
    const curr = roles[h];
    if (!curr) {
      roles[h] = { role, teams: [slug] };
    } else if (ROLE_RANK[role] > ROLE_RANK[curr.role]) {
      roles[h] = { role, teams: [slug] };
    } else if (ROLE_RANK[role] === ROLE_RANK[curr.role]) {
      curr.teams.push(slug);
    }
  }

  for (let i = 0; i < roleTeams.length; i++) {
    const { slug, role } = roleTeams[i];
    process.stdout.write(`\r  [${(i + 1).toString().padStart(3)}/${roleTeams.length}] ${slug.padEnd(60)}`);

    try {
      const members = await ghGetAll(`/orgs/${ORG}/teams/${slug}/members`);
      for (const m of members) applyRole(m.login, role, slug);
      await sleep(120);
    } catch (e) {
      process.stdout.write(` ✗ ${e.message}\n`);
    }
  }

  process.stdout.write('\n');

  // ── 4. Summary ─────────────────────────────────────────────────────
  const counts = Object.values(roles).reduce((acc, { role }) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  console.log('\nRole distribution:');
  for (const [role, count] of Object.entries(counts).sort((a, b) => ROLE_RANK[b[0]] - ROLE_RANK[a[0]])) {
    console.log(`  ${role.padEnd(12)} ${count}`);
  }

  // ── 5. Write output ────────────────────────────────────────────────
  const out  = { fetchedAt: new Date().toISOString(), roles };
  const json = JSON.stringify(out);
  writeFileSync(OUT_PATH, json);
  console.log(`\n✓ Saved ${OUT_PATH}  (${Object.keys(roles).length} contributors with roles)\n`);
}

main().catch(e => { console.error('\nFetch failed:', e.message); process.exit(1); });
