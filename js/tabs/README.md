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

Exports: `loadContributors`, `renderContribTable`, `onContribSearch`, `clearContribSearch`

### `organizations.js`
Organization leaderboard with logo, contribution count, Δ vs. prior period, share %, and an HHI-based concentration indicator. Same cache/live duality as the contributors tab.

Exports: `loadOrganizations`, `renderOrgsTable`, `onOrgSearch`, `clearOrgSearch`

### `concentration.js`
Renders the two side-by-side tiles: **Contributor Bus Factor** (doughnut chart + scrollable core-contributor list) and **Organization Dependency** (doughnut chart + scrollable core-org list).

Exports: `loadConcentration`

### `geography.js`
Renders the full-page choropleth world map and a sortable country table. Delegates map rendering to `js/geo.js`.

Exports: `loadGeography`

### `sigs.js`
Loads `data/sigs.json` on first use (singleton fetch) and renders the SIG/repository leaderboard table with contributor and organization counts. Includes search filtering.

Exports: `loadSigs`, `renderSigsList`, `onSigsSearch`, `clearSigsSearch`

### `coverage.js`
Company-centric counterpart to the SIGs tab: renders the organization leaderboard (same source as `organizations.js`) with SIGs, Maintainers, and Approvers columns showing how many repos each company's contributors touched and how many hold each role in the selected period, computed via `contributorsForOrg()` (`attribution.js`), `sigDetailsForHandles()` (`cache.js`), and `roleFor()` (`roles.js`). Requires both `data/cache.json` and `data/sigs.json`; shows an empty state if either is unavailable. Search and pagination follow the same pattern as the Organizations tab.

Restricted to the `all` platform filter: `data/sigs.json` (`scripts/fetch-sigs.mjs`) is always fetched all-platform, unlike `cacheData()` which is filtered per-platform, so combining the two under e.g. `github`-only would silently mix mismatched-scope numbers in the same row. `loadCoverage()` shows an explanatory empty state instead when a specific platform is selected, and `onCoverageSearch()` guards on the same `coverageAvailable()` check so it safely no-ops rather than throwing — the search box stays visible (and interactive-looking) in every empty state, but there's no cached data behind it to search.

Every early-return path funnels through `showCoverageEmpty()`, which — beyond swapping in the right message — also clears the total/matches label and resets the search box and its clear button. Without that, switching Platform away from "All platforms" (or any other path into the empty state) would leave a stale count like "1,204 total" showing next to the unsupported-platform message.

`loadCoverage()` re-checks the platform/cache/SIGS_CACHE conditions again immediately after `await loadSigsCache()`, not just before it. Filters can change while that fetch is in flight (e.g. the user switches Platform away from "All platforms" during a first-load fetch of `data/sigs.json`); without the second check, a slow-resolving earlier call would render platform-filtered org rows mixed with all-platform SIG counts, clobbering a newer, correctly-empty render that already ran.

Exports: `loadCoverage`, `renderCoverageTable`, `onCoverageSearch`, `clearCoverageSearch`
