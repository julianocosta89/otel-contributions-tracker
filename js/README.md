# js/

ES modules that power the web app. Loaded via `<script type="module" src="js/main.js">` — no bundler, no build step.

## Module map

```
js/
  config.js        constants (PAGE_SIZE, COLORS)
  state.js         mutable globals + S object
  utils.js         formatting helpers + DOM shortcuts
  theme.js         dark/light mode + chart colour palette
  error.js         showError / hideError toast
  companies.js     company name matching + logo resolution
  affiliations.js  gitdm affiliation lookup + loading
  roles.js         GitHub team role badges
  cache.js         data loading, caching, and repo helpers
  api.js           GitHub PR fetches (repo modal breakdowns)
  render.js        shared row/list HTML builders
  geo.js           choropleth world map
  attribution.js   org attribution + HHI concentration
  sort.js          per-tab column sort state + row sorting
  routing.js       URL hash management
  ui.js            tab management, paging, filter controls
  main.js          entry point — init, deep-link routing, event wiring
  tabs/            one module per tab  →  see tabs/README.md
  modals/          one module per modal  →  see modals/README.md
```

## Module responsibilities

### `config.js`
Pure constants. No imports.
- `PAGE_SIZE` — rows per page (25)
- `COLORS` — chart palette

### `state.js`
Single source of truth for mutable runtime state. No imports.

- `S` — session state object: active tab, preset, date filters, page cursors, Chart.js instances, filtered list caches, per-tab column sort state (`S.sort`, keyed by tab name), a transient cross-modal breadcrumb (`S.nav.backTo`, see `js/modals/org.js` and `js/modals/coverage.js`)
- `SORT_DEFAULTS` — the natural (server-provided) `{ key, dir }` sort per tab, used to seed `S.sort` and as the reference `sort.js`'s `isDefaultSort()` compares against
- Loose `let` exports (`CACHE`, `AFFILIATIONS`, `GH_COMPANIES`, `ROLES`, `SIGS_CACHE`) with corresponding setter functions (`setCache`, `setAffiliations`, …). Setters are required because ES module live bindings are read-only from importing modules.

### `utils.js`
No-side-effect helpers used across the codebase.
- **Formatting** — `num` (locale number), `pct` (percentage string), `fmtDate`, `today`, `daysAgo`, `shortYearMonth`
- **DOM** — `el(id)`, `show(id)`, `hide(id)`, `renderStatLinkButton({ count, ariaLabel, onClick })` — builds a stat-tile "N →" `<button>` element (not an HTML string) for the org/coverage modals' cross-links, so an org name containing quotes can't break out of the `aria-label` attribute the way string-interpolated `innerHTML` would
- **Table** — `changeBadge` (coloured Δ% HTML), `deltaCell` (table `<td>` for Δ vs prior period)
- **Charts** — `destroyChart(id)` — destroys and removes a Chart.js instance from `S.charts`
- **Active contributors** — `activeThreshold(preset)` — returns the minimum contributions (≥10/month, scaled to the preset's span) to count as "active" for `30d`/`60d`/`90d`/`6m`/`1y`; returns `null` for longer presets (`2y`, `3y`, `all`) where the split isn't meaningful
- **Dependency / health** — `computeDependency(items)` — mirrors the LFX contributor-dependency / organization-dependency endpoints: sorts a leaderboard by contributions, finds the minimum number of top entries whose cumulative share reaches 51%, and returns `{ topCount, topPercentage, otherCount }` (or `null` for empty/zero-total data). `dependencyColor(topPercentage, topCount)` — classifies a dependency result into a health colour: green (< 51%, well distributed), yellow (51–80%, moderate concentration), or red (> 80%, high concentration), with bus-factor adjustments (topCount ≤ 1 → red, topCount ≤ 2 → at least yellow). Used by the SIGs tab's health bar (`tabs/sigs.js`) and the SIG modal's dependency tiles (`modals/sig.js`)

### `theme.js`
- `isDark()` — reads `html.dark` class
- `C` — lazy colour object (`C.tick()`, `C.grid()`, `C.legend()`, `C.missing()`) used by Chart.js configs
- `initTheme`, `applyTheme(mode)`, `toggleTheme` — theme toggle; dispatches a `themeChanged` custom event instead of calling `reload()` directly (avoids a circular import through `ui.js`)

### `error.js`
`showError(msg)` / `hideError()` — manages the bottom-right error toast. Extracted from `ui.js` to break a potential dependency cycle.

### `companies.js`
Everything related to matching contributor affiliations to leaderboard org names and resolving logos.
- `normCompany(s)` — strips punctuation and legal suffixes for fuzzy comparison
- `resolveAlias(normalized)` — maps known acronyms / rebrand spellings to their canonical form (`CNCF → cloud native computing foundation`, `elasticsearch → elastic`)
- `wordMatch(haystack, needle)` — whole-word substring match (≥ 4-char guard prevents false positives)
- `orgMatchesSearch(orgName, q)` — used for the org search box
- `LOGO_OVERRIDES` — manual logo URLs for orgs not covered by the LF Insights API
- `resolveOrgLogo(org)` — returns the best available logo URL for an org object
- `orgLogoMap()` — lazy map of all org names → logo URLs built from `CACHE`
- `logoForCompany(name)` — resolves a logo for a free-form company name (used in the contributor modal)

### `affiliations.js`
- `affiliationFor(handles)` — returns the currently-active affiliation `{ company, source, file, lineStart, lineEnd }` for a contributor (gitdm takes priority over GitHub profile)
- `affiliationsInWindow(handles, startDate, endDate)` — returns all gitdm ranges overlapping a date window; used for time-aware org attribution and as the Contributors tab's company-history fallback when a period has no `attributedContributions` (e.g. `all`)
- `loadAffiliations()` — fetches `data/affiliations.json`, `data/github-companies.json`, and `data/roles.json` in parallel at startup

### `roles.js`
- `roleFor(handles)` — returns the highest role (`maintainer > approver > code-owner > triager`) a contributor holds anywhere in the org
- `teamsFor(handles)` — returns the GitHub team slugs associated with that org-wide best role
- `roleForRepo(handles, repoName)` / `teamsForRepo(handles, repoName)` — same, but scoped to a single repo/SIG via each team's `rolesByRepo` mapping (built by `scripts/fetch-roles.mjs` from GitHub's own team→repo permissions). Returns `null`/`[]` if the contributor holds no role in that specific repo — never falls back to the org-wide role, since that would mislabel someone with a role earned on an unrelated SIG
- `roleBadge(handles, small, repoName?)` — renders a coloured badge HTML string with an optional tooltip listing team links; pass `repoName` to scope the badge to that repo instead of the org-wide best role
- `ROLE_STYLE` — Tailwind class strings per role, keyed by role name

### `cache.js`
- `usingCache()` — true when the active preset + platform combo is available in `data/cache.json`. There is no live-API fallback when it's false (see "No live-data fallback" below) — every tab shows an empty state instead
- `cacheData()` — returns the cached data object for the active filters
- `loadCache()` — fetches `data/cache.json` at startup; populates the `cached <date>` header tag; silent failure if unavailable (`CACHE` stays `null`, so `usingCache()` returns `false` everywhere)
- `loadSigsCache()` — singleton fetch of `data/sigs.json`; stores result in `SIGS_CACHE`
- `reposFromCache(handles)` — look up repository contribution counts from the already-loaded SIG cache for a contributor
- `sigDetailsForHandles(normalizedHandles)` — like the above but returns full per-repo contributor rows (not just counts); `reposFromSigsCache()` is a thin wrapper that strips it down to `{ name, url, count }`. Powers the Coverage tab/modal's per-SIG people breakdown

### `api.js`
GitHub Issues Search API calls only — see "No live-data fallback" below for why there's no LF Insights client here.
- `fetchContribRepos(handles, startDate, endDate, token?)` — GitHub Issues Search API: finds PRs authored by a contributor in the `open-telemetry` org within the date range, grouped by repository. Optional `token` adds an `Authorization` header (used by `scripts/send-monthly-report.mjs` for a higher rate limit; browser call sites omit it)
- `fetchOrgRepos(contributors, org, startDate, endDate, token?)` — calls `fetchContribRepos` for each contributor in parallel then merges the results. Returns `failedCount` (number of contributors whose search request failed, e.g. rate limiting) alongside `repos`/`totalPRs`/`truncated`; browser call sites ignore it, `scripts/send-monthly-report.mjs` surfaces it as a warning

### `render.js`
Shared HTML builder functions used by both tabs and modals.
- `renderPersonRow(c, i, opts)` — a contributor row (avatar, name, handle, affiliation, contribution count). `opts.sigStyle` renders a wider hover-able variant used in the SIG modal, Coverage modal, and concentration lists; `opts.orgModal` renders the compact variant used inside the org modal. `opts.activeMode` reserves a left-border accent slot (used by the org modal's active-contributor treatment): `opts.atLimit` renders it yellow (contributor sits exactly on the threshold), `opts.active` renders it green, otherwise it's transparent. `opts.showRole` (sigStyle only) appends the maintainer/approver/triager role badge next to the handle — used by the Coverage modal
- `renderOrgRow(o, i, opts)` — an org row (logo, name, count). `opts.sigStyle` renders the hover variant used in the SIG modal and concentration lists
- `renderReposList({ repos, unit, barColor, listElId, note })` — renders a list of repository links with a contribution/PR count label
- `renderActiveDivider(threshold)` — a thin-line divider with a caption ("Less than N contributions · inactive (<10/mo)") marking the boundary between active and occasional contributors in a contributions-sorted list
- `companyCell(c, affiliation, gitdmUrl, ranges)` — renders the company cell for a contributor table row, including multi-employer split stacking with date labels. `ranges` (from `affiliationsInWindow`) is the fallback source of stacking data for periods with no `attributedContributions` (e.g. the `all` preset)
- `primaryCompanyName(c, affiliation, ranges)` — the plain-text company name `companyCell()` shows as "current" (the last stacked entry for a split contributor, otherwise the active affiliation). Exported so the Contributors tab's sort-by-Company (`js/tabs/contributors.js`) matches what's actually displayed instead of always the contributor's present-day affiliation, which can diverge from the last entry in a date-windowed `ranges` fallback
- `personPlaceholder(cls)` / `orgPlaceholder(cls)` — fallback SVG avatars when no image is available

### `geo.js`
- `ISO_A2_TO_NUM` — lookup table: ISO 3166-1 alpha-2 country code → numeric ID used by world-atlas TopoJSON
- `getWorldData()` — lazy-fetches the world-atlas countries TopoJSON from jsDelivr and caches it
- `renderChoropleth(canvasId, chartKey, geoRows)` — builds and registers a Chart.js choropleth using `chartjs-chart-geo`

### `attribution.js`
- `companyMatchesOrg(companyName, orgName)` — determines whether a contributor's employer affiliation belongs to a given leaderboard org (handles acronyms, space-stripped names, aliases)
- `companyMatchesOrgNormalized(cn, on)` — same matching rules, but takes already-`normCompany()`'d strings; `companyMatchesOrg` normalizes then delegates to this. Split out so bulk callers that need every-org × every-contributor matches (e.g. the Coverage tab's sort-by-Maintainers/Approvers) can normalize once per contributor instead of once per comparison — normCompany() is the expensive part at that O(orgs × contributors) scale
- `contributorsForOrg(orgName)` — returns the list of contributors to attribute to an org for the current window, using `attributedContributions[]` for split contributors
- `calcOrgConcentration(contribs, orgTotal)` — computes the HHI concentration score and returns a `{ status, hhi, top1Pct, label, color }` result
- `renderOrgConcentration(contribs, orgTotal)` — writes the concentration indicator HTML into `#org-modal-concentration`

### `sort.js`
Generic client-side column sorting shared by every tab's table. No tab-specific knowledge — each tab module supplies its own `accessor(row, key)` and calls these against its own slice of `S.sort`.
- `toggleSort(tab, key)` — mutates `S.sort[tab]`: clicking the already-active column flips direction; a new column picks a sensible default (ascending for name-like text columns, descending for numeric ones, since "most X" is usually what's wanted first)
- `sortRows(rows, tab, accessor)` — returns a new stably-sorted array per the tab's current `S.sort` state (equal values keep their original relative order)
- `isDefaultSort(tab)` — true when the tab's sort still matches `SORT_DEFAULTS` (state.js) — tabs use this to decide whether search's "true leaderboard rank" lookup still applies (it stops making sense once rows are reordered by something other than the natural order)
- `updateSortIndicators(scopeSelector, tab)` — refreshes the ▲/▼ arrow on the active `[data-sort-key]` header button within `scopeSelector` (e.g. `#contrib-table-wrap`) after a re-render

### `routing.js`
Pure URL helpers — no side effects, no imports from tabs or modals.

Hash format: `#tab` | `#tab/timeframe` | `#tab/timeframe/detail`
- `timeframe` is a preset key (`1y`, `90d`, …)
- `detail` is a page ref (`page/N`) or a URL-encoded entity name

Exports:
- `VALID_TABS` — array of valid tab names used to validate hash fragments
- `VALID_PRESETS` — array of valid preset keys (`30d`, `60d`, `90d`, `6m`, `1y`, `2y`, `3y`, `all`)
- `timeframeHash(S)` — returns the URL-safe timeframe string for the current state (`S.preset`)
- `setHash(tab, timeframe, detail)` — writes `#tab`, `#tab/timeframe`, or `#tab/timeframe/detail` to the address bar via `history.replaceState`
- `pageDetail(pageIndex)` — converts a 0-indexed page to a `page/N` URL detail string (or `null` for page 0)
- `parseHash()` — splits `location.hash` into `{ tab, timeframe, detail }` (all optional); backward-compatible with old `#tab/detail` hashes that omit the timeframe segment
- `applyPageDetail(tab, detail, S)` — if `detail` is a `page/N` string, sets `S.pages[tab]` and returns `true`

### `ui.js`
Tab orchestration and filter controls. Imports all six tab loaders.
- `setTab(tab, opts)` — switches the active tab, updates the nav indicator, clears search inputs, updates the hash, and calls `loadTab`
- `reload()` — resets page cursors to 0 and re-runs the active tab
- `loadTab(tab)` — dispatches to the correct tab loader function
- `changePage(type, delta)` — advances/retreats a paginated tab and updates the hash
- `updatePager(prefix, page, totalPages)` — updates the pagination controls for a table
- `setPreset(preset)` — sets the active date preset, recalculates `startDate`/`endDate`, and calls `reload`
- `onFilterChange()` — handler for the platform select
- Re-exports `showError` / `hideError` from `error.js`
- Listens for `themeChanged` (from `theme.js`) to call `reload()`

### `main.js`
Entry point. Runs `init()` on load.
- `init()` — applies saved theme, awaits `loadCache()` + `loadAffiliations()` in parallel, then parses the hash, applies the requested timeframe (defaulting to `1y` when omitted), restores page/detail state, and switches to the requested tab
- `resolvePendingDetail(tab)` — when a deep-link `#tab/detail` was present at startup, opens the correct modal once the tab's data has finished loading. Triggered by the `tabLoaded` custom event dispatched from each tab loader. The `coverage` branch additionally checks `coverageAvailable()` (`tabs/coverage.js`) before opening — `tabLoaded` fires even when `loadCoverage()` rendered its empty state (unsupported platform / no cache), so without this a stale or cross-modal-linked `#coverage/...` hash could pop the modal open over that empty state using mismatched-scope data
- Registers delegated click handlers for `.contrib-row`, `.org-row`, `.sig-row`
- Registers the global Escape key listener (`closeOrgModal`, `closeContribModal`, `closeSigModal`)
- Registers the `hashchange` listener for in-session navigation
- Manages the role-badge fixed-position tooltip (`mouseover`/`mouseout`)
- `Object.assign(window, { ... })` — exposes the functions needed by inline `onclick`/`oninput` handlers in `index.html`, including each tab's `on<Tab>Sort(key)` handler for sortable column headers

## No live-data fallback

Every tab's `load*()` renders from `data/cache.json` only. There used to be a "live API" fallback (a direct browser call to the LF Insights widget API) for whenever `usingCache()` was false, but this deployment has no CORS configuration on that endpoint — the fallback could never actually succeed here, it just replaced one failure (missing cache) with a different, more confusing one (a network error whose message blamed CORS). It was removed: `usingCache()` now gates each tab between its normal render and an empty state (`#<tab>-empty` in `index.html`, same visual pattern as the pre-existing Coverage/SIGs empty states), and `js/api.js` only contains the unrelated GitHub Issues Search calls used for repo-breakdown modals (which _do_ support anonymous CORS).

This means `data/cache.json` being present and covering the active preset/platform is now a hard requirement for the app to show anything at all — see `.github/workflows/refresh-data.yml`'s failure-alerting step and `scripts/fetch-data.mjs`'s refusal to write an incomplete cache (`data/README.md`) for how that's kept reliable.

## Dependency notes

Two patterns were used to break potential circular imports:

1. **Event dispatch instead of direct calls** — `toggleTheme` (in `theme.js`) dispatches `themeChanged`; `ui.js` calls `reload()` in response. This avoids `theme → ui → tabs/concentration → theme`.

2. **`tabLoaded` event for deep-link resolution** — tab loaders dispatch `tabLoaded` on success; `main.js` calls `resolvePendingDetail`. This avoids `main → tabs → main` circular imports.
