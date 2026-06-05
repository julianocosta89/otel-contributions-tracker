# Scripts

Node.js ESM scripts that populate the `data/` directory. No `npm install` needed. Requires Node.js 20+.

## Overview

| Script | Output file | Auth required | Run frequency |
|--------|-------------|---------------|---------------|
| `fetch-data.mjs` | `data/cache.json` | None | Daily |
| `fetch-sigs.mjs` | `data/sigs.json` | `GITHUB_TOKEN` (optional) | Daily |
| `fetch-affiliations.mjs` | `data/affiliations.json` | None | Weekly |
| `fetch-github-companies.mjs` | `data/github-companies.json` | `GITHUB_TOKEN` (required) | Weekly |
| `fetch-roles.mjs` | `data/roles.json` | `GITHUB_TOKEN` with `read:org` | Weekly |

`enrich-attribution.mjs` is a helper module imported by `fetch-data.mjs`. It is not an entry-point script and is not run directly.

---

## fetch-data.mjs

Calls the LF Insights API and writes `data/cache.json`. This is the primary data source for the app.

**Cache structure:**

- `periods` — full paginated contributor and org leaderboards for all 8 time presets, using the all-platforms / all-activity-types filter
- `filterCombos` — summary stats and full leaderboards for each preset × platform combination (platforms: `github`, `git`, `gerrit`, `gitlab`, `confluence`, `jira`)
- `sources` — per-period and per-platform freshness metadata, including cached fallback status when a refresh slice failed but older data was preserved

**Time presets:** `30d`, `60d`, `90d`, `6m`, `1y`, `2y`, `3y`, `all`

**Smart refresh:** Short presets (`30d`–`1y`) always refresh. Long presets (`2y`, `3y`, `all`) are skipped if already cached within the last 7 days. Pass `--full` to force-refresh everything.

**Period-over-period:** For each preset, the equivalent prior period is also fetched (e.g. the previous year for `1y`). Each contributor and org entry gets a `previousContributions` field attached.

**Attribution enrichment:** After fetching each period's leaderboard, `enrich-attribution.mjs` is called to add `attributedContributions[]` to contributors who changed employers within the query window. Reads `data/affiliations.json` at startup — run `fetch-affiliations.mjs` first if refreshing both. The `all`-time preset skips attribution (`skipAttribution: true`).

**API base:** `https://insights.linuxfoundation.org/api/project/opentelemetry` — no authentication required.

```bash
node scripts/fetch-data.mjs           # smart refresh
node scripts/fetch-data.mjs --full    # force-refresh everything
```

---

## fetch-sigs.mjs

Fetches per-repository (per-SIG) contributor and org leaderboards and writes `data/sigs.json`.

Queries the GitHub API for all non-archived repos in the `open-telemetry` org, then for each repo fetches the full contributor and org leaderboard from LF Insights for all 8 time presets. Repos are processed 3 at a time.

Applies the same smart-refresh logic as `fetch-data.mjs`: short presets always refresh, long presets are skipped if their per-period source metadata is less than 7 days old. If source metadata is missing, the period is refreshed so future runs can make the skip decision accurately.

`GITHUB_TOKEN` is optional but recommended — without it, the GitHub API list-repos call is subject to the unauthenticated rate limit (60 req/hr). LF Insights calls do not require auth.

```bash
node scripts/fetch-sigs.mjs                       # smart refresh
node scripts/fetch-sigs.mjs --full                # force-refresh everything
GITHUB_TOKEN=ghp_xxx node scripts/fetch-sigs.mjs  # with auth for higher GH rate limit
```

---

## fetch-affiliations.mjs

Builds `data/affiliations.json` — a `githubHandle → affiliation history` map — from the [CNCF gitdm](https://github.com/cncf/gitdm) project.

Fetches `developers_affiliations{N}.txt` files sequentially from the gitdm repository, starting at 1 and stopping at the first 404 so newly-added files are picked up automatically. Parses the gitdm format: each record is a `handle: email` line followed by tab-indented affiliation entries that can carry `from` and `until` date qualifiers.

**Stored per handle:**
- `ranges[]` — the full ordered list of affiliation periods (`from`/`until` as ISO strings; `null` = open-ended)
- `company` — the currently-active employer (shortcut for backward-compatible lookups)
- `lineStart` / `lineEnd` — the line range of the contributor's affiliation block, used to link directly to the correct section in the gitdm source file
- `file` — which `developers_affiliations{N}.txt` file the entry came from (later files override earlier ones)

A handle is only included if it has at least one currently-active affiliation. No authentication required.

The key functions (`parseAffiliations`, `allRanges`, `activeCompany`) are exported for use in tests.

```bash
node scripts/fetch-affiliations.mjs
```

---

## fetch-github-companies.mjs

Fills affiliation gaps by fetching the GitHub profile company field for contributors not covered by `data/affiliations.json`. Writes `data/github-companies.json`.

**Inputs required (must exist before running):**
- `data/cache.json` — contributor handles are sourced from all cached periods
- `data/affiliations.json` — handles already covered by gitdm are skipped

**Incremental / resumable:** Results are saved every 50 requests, so the script can be interrupted and restarted without losing progress. Handles already present in `github-companies.json` are not re-fetched unless their cached value is `null`; null entries are cleared each run so recently-updated GitHub profile companies can be picked up.

**Rate limiting:** 100ms delay between requests. On `429` or `403` responses, reads the `x-ratelimit-reset` header and waits accordingly.

**Auth:** Requires a GitHub token with default scopes (public data access). Provide via env var or rely on the `gh` CLI's stored credentials.

```bash
node scripts/fetch-github-companies.mjs                        # uses gh auth token
GITHUB_TOKEN=ghp_xxx node scripts/fetch-github-companies.mjs
```

---

## fetch-roles.mjs

Fetches GitHub team memberships from the `open-telemetry` org and maps team slugs to roles. Writes `data/roles.json`.

**Team slug → role mapping:**

| Pattern | Role |
|---------|------|
| `*-maintainers` | `maintainer` |
| `*-approvers` | `approver` |
| `*-contributors` | `code-owner` |
| `*-triagers` | `triager` |

Each contributor is assigned only their highest role (maintainer > approver > code-owner > triager).

**Auth:** Requires `GITHUB_TOKEN` with `read:org` scope.

```bash
GITHUB_TOKEN=ghp_xxx node scripts/fetch-roles.mjs
```

---

---

## enrich-attribution.mjs

Helper module imported by `fetch-data.mjs` — not run directly.

Mutates a contributor leaderboard in place by adding `attributedContributions[]` to any contributor whose gitdm affiliation changed within the query window.

**Hybrid strategy:**
- **Top 100 contributors** — for each unique company-switch date that falls within the window, a real LFX sub-period API call is made. The contributor's actual contribution count for each sub-period is fetched and stored with `method: "actual"`. If a contributor isn't found within the 1 000-contributor depth cap, it falls back to proportional.
- **Contributors ranked 101+** — contributions are split proportionally by the number of days spent at each company within the window. Stored with `method: "proportional"`.
- **Single-company contributors** — no `attributedContributions` field is added.

Exported helpers (used in tests): `enrichWithAttribution`, `intersectingRanges`, `buildSubWindows`, `clampRange`, `daysBetween`.

---

## Run order

When setting up from scratch, respect these dependencies:

```
1. fetch-affiliations.mjs    # required by fetch-data.mjs (attribution) and fetch-github-companies.mjs
2. fetch-data.mjs            # required by fetch-github-companies.mjs
3. fetch-github-companies.mjs
4. fetch-sigs.mjs            # independent
5. fetch-roles.mjs           # independent
```

`fetch-data.mjs` reads `affiliations.json` at startup. When refreshing both in the same run, always complete `fetch-affiliations.mjs` before starting `fetch-data.mjs`. The parallel `make fetch-data` target does not guarantee this order — use the sequential form when attribution accuracy matters:

```bash
make fetch-affiliations
node scripts/fetch-data.mjs --full
```
