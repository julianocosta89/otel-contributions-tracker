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
