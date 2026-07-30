# js/tabs/

One module per tab. Each module exports a single `load*` function that is called by `ui.js` whenever the tab becomes active or the active filters change.

At the end of every successful load, the module dispatches:
```js
document.dispatchEvent(new CustomEvent('tabLoaded', { detail: '<tab-name>' }));
```
`main.js` listens for this event to open any pending deep-link modal (e.g. `#contributors/username`).

## Modules

### `overview.js`
Populates the Overview tab: four stat cards (contributors, orgs, maintainers, reviewers), the contribution-concentration doughnut chart, the top-15 org list, and the mini choropleth map.

Exports: `loadOverview`

### `contributors.js`
Contributor leaderboard with avatar, GitHub handles, contribution count, Δ vs. prior period, share %, company (with multi-employer split support), and role badges. Supports client-side full-dataset search when cache is active; falls back to page-scoped search against the live API.

Column headers for Contributor (name), Contributions, vs prev (Δ%), and Company are sortable — click toggles ascending/descending via `onContribSort(key)` (`js/sort.js`). Sorting is client-side and cache-only (the live-API fallback path keeps its server-given order). The `#` column always shows the contributor's true leaderboard rank (their position in `cacheData().contributors.data`, which is contributions-sorted) regardless of the table's current sort or search filter — #1 stays #1 whether you sort alphabetically or search for a name; only the column *order* changes.

Exports: `loadContributors`, `renderContribTable`, `onContribSearch`, `clearContribSearch`, `onContribSort`

### `organizations.js`
Organization leaderboard with logo, contribution count, Δ vs. prior period, share %, and an HHI-based concentration indicator. Same cache/live duality as the contributors tab.

Organization (name), Contributions, and vs prev are sortable (`onOrgSort(key)`); Share and Concentration aren't — Share is always the same order as Contributions (it's a fixed ratio of it), and Concentration would need an HHI computed for every org up front rather than just the visible page. Same as the Contributors tab: the `#` column always shows true leaderboard rank (by Contributions) regardless of the table's current sort or search filter.

Exports: `loadOrganizations`, `renderOrgsTable`, `onOrgSearch`, `clearOrgSearch`, `onOrgSort`

### `concentration.js`
Renders the two side-by-side tiles: **Contributor Bus Factor** (doughnut chart + scrollable core-contributor list) and **Organization Dependency** (doughnut chart + scrollable core-org list).

Exports: `loadConcentration`

### `geography.js`
Renders the full-page choropleth world map and a country table. Delegates map rendering to `js/geo.js`.

Country (name) and Count are sortable (`onGeoSort(key)`); Share isn't shown as its own sort option since it's a fixed ratio of Count and would always produce the same order. The full country list is cached in a module-level variable (`_geoAll`) on load so a sort click just re-renders the table locally — it doesn't touch the map, which looks countries up by ISO code and so doesn't care about array order.

Exports: `loadGeography`, `onGeoSort`

### `sigs.js`
Loads `data/sigs.json` on first use (singleton fetch) and renders the SIG/repository leaderboard table with contributor and organization counts. Includes search filtering.

Repository (name), Contributors, and Organizations are all independently sortable (`onSigsSort(key)`) — unlike Contributions/Share elsewhere, a repo's contributor count and organization count don't move in lockstep, so both are useful sort keys. Each entry's `rank` (used for the `#` column) is assigned once, by contributor count (the tab's natural order), before the display sort reorders the array for rendering — so #1 stays the repo with the most contributors no matter which column the table is currently sorted by.

Exports: `loadSigs`, `renderSigsList`, `onSigsSearch`, `clearSigsSearch`, `onSigsSort`

### `coverage.js`
Company-centric counterpart to the SIGs tab: renders the organization leaderboard (same source as `organizations.js`) with SIGs, Maintainers, and Approvers columns showing how many repos each company's contributors touched and how many hold each role in the selected period, computed via `contributorsForOrg()` (`attribution.js`), `sigDetailsForHandles()` (`cache.js`), and `roleFor()` (`roles.js`). Requires both `data/cache.json` and `data/sigs.json`; shows an empty state if either is unavailable. Search and pagination follow the same pattern as the Organizations tab.

Restricted to the `all` platform filter: `data/sigs.json` (`scripts/fetch-sigs.mjs`) is always fetched all-platform, unlike `cacheData()` which is filtered per-platform, so combining the two under e.g. `github`-only would silently mix mismatched-scope numbers in the same row. `loadCoverage()` shows an explanatory empty state instead when a specific platform is selected, and `onCoverageSearch()` guards on the same `coverageAvailable()` check so it safely no-ops rather than throwing — the search box stays visible (and interactive-looking) in every empty state, but there's no cached data behind it to search.

Every early-return path funnels through `showCoverageEmpty()`, which — beyond swapping in the right message — also clears the total/matches label and resets the search box and its clear button. Without that, switching Platform away from "All platforms" (or any other path into the empty state) would leave a stale count like "1,204 total" showing next to the unsupported-platform message.

`loadCoverage()` re-checks the platform/cache/SIGS_CACHE conditions again immediately after `await loadSigsCache()`, not just before it. Filters can change while that fetch is in flight (e.g. the user switches Platform away from "All platforms" during a first-load fetch of `data/sigs.json`); without the second check, a slow-resolving earlier call would render platform-filtered org rows mixed with all-platform SIG counts, clobbering a newer, correctly-empty render that already ran.

Company (name), SIGs, Maintainers, Approvers, and Contributions are all independently sortable (`onCoverageSort(key)`) — this is what lets you answer "which companies have the most maintainers/approvers" directly. Company/Contributions sort re-use the existing cheap per-visible-row `statsForOrg()` call; sorting by SIGs/Maintainers/Approvers needs every org's counts computed up front (you can't page-sort by a value you haven't computed for the un-paged rows yet), which naively means matching every one of ~5,300 contributors against every one of ~1,200 orgs. `contributorsForOrg()` re-normalizes both the org name and each contributor's company string on every single call, which makes that naive approach take multiple seconds — slow enough to feel like a UI hang. `statsForAllOrgs()` avoids the redundant work by normalizing each contributor's company once (not once per org) via `companyMatchesOrgNormalized()` (`attribution.js`), and memoizes the resulting per-org stats `Map` in a `WeakMap` keyed by the `organizations.data` array reference — stable per preset+platform combo — so the cost is paid once per combo, not on every sort click or page turn.

Like the Contributors/Organizations tabs, the `#` column always shows the company's true rank (by Contributions, via the same `organizations.data` order) regardless of the table's current sort or search filter — the company with the most contributions is always #1, even when the table is currently sorted by Maintainers or Company name.

Exports: `loadCoverage`, `renderCoverageTable`, `onCoverageSearch`, `clearCoverageSearch`, `onCoverageSort`
