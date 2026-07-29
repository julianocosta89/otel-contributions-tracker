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
 * Each role team is also mapped to the repos it actually *owns* (via the
 * team's own /repos endpoint) so a contributor's role can be scoped to a
 * specific repo/SIG, not just their single best role org-wide.
 *
 * Ownership can't be determined by a single fixed permission level (e.g.
 * "maintain or admin") — GitHub's permission ceiling differs per role tier
 * (a *-maintainers team's own repo is often "maintain", but a *-approvers
 * team's own repo is normally just "write", and a *-contributors team's own
 * repo can be as low as "read"). Instead, for each repo we compute the max
 * permission level held by ANY team of a given role tier, and only count a
 * team as owning that repo if its own permission there matches that tier's
 * ceiling. This is what distinguishes e.g. rust-approvers' real ownership of
 * opentelemetry-rust (where they hold approver-tier's max permission there)
 * from their merely-incidental "triage" access to the shared opentelemetry.io
 * docs site (where docs-approvers holds the actual approver-tier ceiling).
 *
 * Output: data/roles.json
 *   { fetchedAt, roles: { githubHandle: {
 *       role: "maintainer" | "approver" | "code-owner" | "triager",  // best role org-wide
 *       teams: string[],                                              // teams that earned that best role
 *       rolesByRepo: { repoName: { role, teams: string[] } }          // best role scoped to each repo
 *   } } }
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

const PERM_RANK = { none: 0, read: 1, triage: 2, write: 3, maintain: 4, admin: 5 };

function permRankOf(repo) {
  if (repo.role_name && repo.role_name in PERM_RANK) return PERM_RANK[repo.role_name];
  const p = repo.permissions || {};
  if (p.admin) return PERM_RANK.admin;
  if (p.maintain) return PERM_RANK.maintain;
  if (p.push) return PERM_RANK.write;
  if (p.triage) return PERM_RANK.triage;
  if (p.pull) return PERM_RANK.read;
  return PERM_RANK.none;
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

  // ── 3. Fetch each role team's repos (with permission level) ────────
  console.log('── Fetching repos per team…');
  const teamRepos = new Map(); // slug → [{ name, permRank }]

  for (let i = 0; i < roleTeams.length; i++) {
    const { slug } = roleTeams[i];
    process.stdout.write(`\r  [${(i + 1).toString().padStart(3)}/${roleTeams.length}] ${slug.padEnd(60)}`);
    try {
      const repos = await ghGetAll(`/orgs/${ORG}/teams/${slug}/repos`);
      teamRepos.set(slug, repos.map(r => ({ name: r.name, permRank: permRankOf(r) })));
      await sleep(120);
    } catch (e) {
      process.stdout.write(` ✗ ${e.message}\n`);
      teamRepos.set(slug, []);
    }
  }
  process.stdout.write('\n');

  // ── 4. Compute, per repo and role tier, the max permission any team of ──
  //      that tier holds there — the signal for "this team truly owns it"
  const repoTierMax = {}; // repo → role → maxPermRank
  for (const { slug, role } of roleTeams) {
    for (const { name, permRank } of teamRepos.get(slug)) {
      repoTierMax[name] ??= {};
      if (!(role in repoTierMax[name]) || permRank > repoTierMax[name][role]) {
        repoTierMax[name][role] = permRank;
      }
    }
  }

  // ── 5. Fetch members per team, apply hierarchy scoped to owned repos ────
  console.log('── Fetching members per team…');
  const roles = {}; // handle (lowercase) → { role, teams: string[], rolesByRepo: { repo: { role, teams } } }

  function applyRole(handle, role, slug, repoNames) {
    const h = handle.toLowerCase();
    if (!roles[h]) {
      roles[h] = { role, teams: [slug], rolesByRepo: {} };
    } else if (ROLE_RANK[role] > ROLE_RANK[roles[h].role]) {
      roles[h].role  = role;
      roles[h].teams = [slug];
    } else if (ROLE_RANK[role] === ROLE_RANK[roles[h].role]) {
      roles[h].teams.push(slug);
    }

    const byRepo = roles[h].rolesByRepo;
    for (const repo of repoNames) {
      const existing = byRepo[repo];
      if (!existing || ROLE_RANK[role] > ROLE_RANK[existing.role]) {
        byRepo[repo] = { role, teams: [slug] };
      } else if (ROLE_RANK[role] === ROLE_RANK[existing.role] && !existing.teams.includes(slug)) {
        existing.teams.push(slug);
      }
    }
  }

  for (let i = 0; i < roleTeams.length; i++) {
    const { slug, role } = roleTeams[i];
    process.stdout.write(`\r  [${(i + 1).toString().padStart(3)}/${roleTeams.length}] ${slug.padEnd(60)}`);

    try {
      const members = await ghGetAll(`/orgs/${ORG}/teams/${slug}/members`);
      const repoNames = teamRepos.get(slug)
        .filter(({ name, permRank }) => permRank === repoTierMax[name][role])
        .map(r => r.name);
      for (const m of members) applyRole(m.login, role, slug, repoNames);
      await sleep(120);
    } catch (e) {
      process.stdout.write(` ✗ ${e.message}\n`);
    }
  }

  process.stdout.write('\n');

  // ── 6. Summary ─────────────────────────────────────────────────────
  const counts = Object.values(roles).reduce((acc, { role }) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  console.log('\nRole distribution:');
  for (const [role, count] of Object.entries(counts).sort((a, b) => ROLE_RANK[b[0]] - ROLE_RANK[a[0]])) {
    console.log(`  ${role.padEnd(12)} ${count}`);
  }

  // ── 7. Write output ────────────────────────────────────────────────
  const out  = { fetchedAt: new Date().toISOString(), roles };
  const json = JSON.stringify(out);
  writeFileSync(OUT_PATH, json);
  console.log(`\n✓ Saved ${OUT_PATH}  (${Object.keys(roles).length} contributors with roles)\n`);
}

main().catch(e => { console.error('\nFetch failed:', e.message); process.exit(1); });
