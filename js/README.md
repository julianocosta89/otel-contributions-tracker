# js/

ES modules that power the web app. Loaded via `<script type="module" src="js/main.js">` — no bundler, no build step.

## Module map

```
js/
  config.js        constants (API_BASE, PAGE_SIZE, COLORS)
  state.js         mutable globals + S object
  utils.js         formatting helpers + DOM shortcuts
  theme.js         dark/light mode + chart colour palette
  error.js         showError / hideError toast
  companies.js     company name matching + logo resolution
  affiliations.js  gitdm affiliation lookup + loading
  roles.js         GitHub team role badges
  cache.js         data loading, caching, and repo helpers
  api.js           live API calls + GitHub PR fetches
  render.js        shared row/list HTML builders
  geo.js           choropleth world map
  attribution.js   org attribution + HHI concentration
  routing.js       URL hash management
  ui.js            tab management, paging, filter controls
  main.js          entry point — init, deep-link routing, event wiring
  tabs/            one module per tab  →  see tabs/README.md
  modals/          one module per modal  →  see modals/README.md
```

## Module responsibilities

### `config.js`
Pure constants. No imports.
- `API_BASE` — LF Insights endpoint prefix
- `PAGE_SIZE` — rows per page (25)
- `COLORS` — chart palette

### `state.js`
Single source of truth for mutable runtime state. No imports.

- `S` — session state object: active tab, preset, date filters, page cursors, Chart.js instances, filtered list caches
- Loose `let` exports (`CACHE`, `AFFILIATIONS`, `GH_COMPANIES`, `ROLES`, `SIGS_CACHE`) with corresponding setter functions (`setCache`, `setAffiliations`, …). Setters are required because ES module live bindings are read-only from importing modules.

### `utils.js`
No-side-effect helpers used across the codebase.
- **Formatting** — `num` (locale number), `pct` (percentage string), `fmtDate`, `today`, `daysAgo`, `shortYearMonth`
- **DOM** — `el(id)`, `show(id)`, `hide(id)`
- **Table** — `changeBadge` (coloured Δ% HTML), `deltaCell` (table `<td>` for Δ vs prior period)
- **Charts** — `destroyChart(id)` — destroys and removes a Chart.js instance from `S.charts`

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
- `affiliationsInWindow(handles, startDate, endDate)` — returns all gitdm ranges overlapping a date window; used for time-aware org attribution
- `loadAffiliations()` — fetches `data/affiliations.json`, `data/github-companies.json`, and `data/roles.json` in parallel at startup

### `roles.js`
- `roleFor(handles)` — returns the highest role (`maintainer > approver > code-owner > triager`) for a contributor
- `teamsFor(handles)` — returns the GitHub team slugs associated with that role
- `roleBadge(handles, small)` — renders a coloured badge HTML string with an optional tooltip listing team links
- `ROLE_STYLE` — Tailwind class strings per role, keyed by role name

### `cache.js`
- `usingCache()` — true when the active preset + platform combo is available in `data/cache.json`
- `cacheData()` — returns the cached data object for the active filters
- `loadCache()` — fetches `data/cache.json` at startup; populates the `cached <date>` header tag; silent failure if unavailable
- `loadSigsCache()` — singleton fetch of `data/sigs.json`; stores result in `SIGS_CACHE`
- `reposFromCache(handles)` / `orgReposFromCache(contributors)` — look up repository contribution counts from the already-loaded SIG cache for a contributor or org's full contributor list

### `api.js`
- `liveApi(path, extra)` — wraps `fetch` against `API_BASE` with the active query string
- `buildQS(extra)` — assembles the shared query string from current filter state
- `fetchContribRepos(handles, startDate, endDate)` — GitHub Issues Search API: finds PRs authored by a contributor in the `open-telemetry` org within the date range, grouped by repository
- `fetchOrgRepos(contributors, org, startDate, endDate)` — calls `fetchContribRepos` for each contributor in parallel then merges the results

### `render.js`
Shared HTML builder functions used by both tabs and modals.
- `renderPersonRow(c, i, opts)` — a contributor row (avatar, name, handle, affiliation, contribution count). `opts.sigStyle` renders a wider hover-able variant used in the SIG modal and concentration lists; `opts.orgModal` renders the compact variant used inside the org modal
- `renderOrgRow(o, i, opts)` — an org row (logo, name, count). `opts.sigStyle` renders the hover variant used in the SIG modal and concentration lists
- `renderReposList({ repos, unit, barColor, listElId, note })` — renders a list of repository links with a contribution/PR count label
- `companyCell(c, affiliation, gitdmUrl)` — renders the company cell for a contributor table row, including multi-employer split stacking with date labels
- `personPlaceholder(cls)` / `orgPlaceholder(cls)` — fallback SVG avatars when no image is available

### `geo.js`
- `ISO_A2_TO_NUM` — lookup table: ISO 3166-1 alpha-2 country code → numeric ID used by world-atlas TopoJSON
- `getWorldData()` — lazy-fetches the world-atlas countries TopoJSON from jsDelivr and caches it
- `renderChoropleth(canvasId, chartKey, geoRows)` — builds and registers a Chart.js choropleth using `chartjs-chart-geo`

### `attribution.js`
- `companyMatchesOrg(companyName, orgName)` — determines whether a contributor's employer affiliation belongs to a given leaderboard org (handles acronyms, space-stripped names, aliases)
- `contributorsForOrg(orgName)` — returns the list of contributors to attribute to an org for the current window, using `attributedContributions[]` for split contributors
- `calcOrgConcentration(contribs, orgTotal)` — computes the HHI concentration score and returns a `{ status, hhi, top1Pct, label, color }` result
- `renderOrgConcentration(contribs, orgTotal)` — writes the concentration indicator HTML into `#org-modal-concentration`

### `routing.js`
Pure URL helpers — no side effects, no imports from tabs or modals.

Hash format: `#tab` | `#tab/timeframe` | `#tab/timeframe/detail`
- `timeframe` is a preset key (`1y`, `90d`, …) or a custom date range (`2025-01-01..2026-01-01`)
- `detail` is a page ref (`page/N`) or a URL-encoded entity name

Exports:
- `VALID_TABS` — array of valid tab names used to validate hash fragments
- `VALID_PRESETS` — array of valid preset keys (`30d`, `60d`, `90d`, `6m`, `1y`, `2y`, `3y`, `all`)
- `timeframeHash(S)` — returns the URL-safe timeframe string for the current state (`S.preset` or `startDate..endDate` for custom ranges)
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
- `resolvePendingDetail(tab)` — when a deep-link `#tab/detail` was present at startup, opens the correct modal once the tab's data has finished loading. Triggered by the `tabLoaded` custom event dispatched from each tab loader
- Registers delegated click handlers for `.contrib-row`, `.org-row`, `.sig-row`
- Registers the global Escape key listener (`closeOrgModal`, `closeContribModal`, `closeSigModal`)
- Registers the `hashchange` listener for in-session navigation
- Manages the role-badge fixed-position tooltip (`mouseover`/`mouseout`)
- `Object.assign(window, { ... })` — exposes 16 functions needed by inline `onclick`/`oninput` handlers in `index.html`

## Dependency notes

Two patterns were used to break potential circular imports:

1. **Event dispatch instead of direct calls** — `toggleTheme` (in `theme.js`) dispatches `themeChanged`; `ui.js` calls `reload()` in response. This avoids `theme → ui → tabs/concentration → theme`.

2. **`tabLoaded` event for deep-link resolution** — tab loaders dispatch `tabLoaded` on success; `main.js` calls `resolvePendingDetail`. This avoids `main → tabs → main` circular imports.
