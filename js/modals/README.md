# js/modals/

Right-panel slide-in modals. Each modal manages its own open/close animation and writes its deep-link hash via `js/routing.js`.

The slide-in transition is CSS-driven: the panel starts at `translateX(100%)` (off-screen right) and the `.open` class in `css/app.css` returns it to `translateX(0)`. Opening always does two nested `requestAnimationFrame` calls to ensure the browser has painted the visible state before the transition starts.

Delegated click handlers (`tr.contrib-row`, `tr.org-row`, `tr.sig-row`, `tr.coverage-row`) and the global Escape key listener live in `main.js`, which calls the relevant `open*Modal` function.

The Escape handler calls all four `close*Modal` functions unconditionally (it doesn't track which one is actually open), so every `close*Modal` starts with a guard — `if (!panel.classList.contains('open')) return;` — that no-ops for the three that weren't open. Without it, whichever modal's close function ran last would always win the `setHash()` call, silently overwriting the URL with the wrong tab regardless of which modal the user actually closed.

## Modules

### `contributor.js`
Opens when a row in the Contributors tab is clicked. Shows avatar, handles, contribution count, share, company logo/name, role badge, and the list of repositories the contributor was active in during the selected period.

Repository data comes from `data/sigs.json` (via `reposFromCache`) when available; falls back to a live GitHub PR search (`api.js → fetchContribRepos`).

Exports: `openContribModal`, `closeContribModal`, `renderContribRepos`

### `org.js`
Opens when a row in the Organizations tab is clicked. Shows the org logo, contribution total, contributor count, maintainer/approver counts, an HHI concentration indicator, and a scrollable contributor list with per-person share bars.

The "Repositories" stat tile shows a count (`sigDetailsForHandles()` in `cache.js`) rather than an inline list — the per-repo/per-person breakdown already exists in the Coverage modal (`coverage.js`, below), so the tile is rendered as a "N →" `<button>` (via `renderStatLinkButton()` in `utils.js`) instead of duplicating that view here, rather than a clickable `<div>`, so it's focusable and Enter/Space-activatable. `renderStatLinkButton()` builds the element and sets its `aria-label` via `setAttribute` rather than interpolating the org name into an HTML string — some committed org names contain quotes (e.g. `Ювелирная сеть "585"`), which would otherwise break out of the attribute. Only clickable when Coverage itself could render for the current filters (cache-backed data + "All platforms"); otherwise the tile is plain, button-less dash text.

That availability gate is checked twice: once synchronously, and again after `await loadSigsCache()` resolves, guarded by a module-level `_openSeq` counter bumped on every `openOrgModal()` call. Both matter — closing this modal and changing the platform filter while a slow `data/sigs.json` fetch is still in flight can otherwise leave a stale continuation writing a mismatched-scope repo link into whatever the tile now represents (a reopened modal for a different org, or this same org under a filter Coverage no longer supports).

Clicking the button navigates by hash (`location.hash = '#coverage/<timeframe>/<org name>'`) rather than calling `openCoverageModal()` directly — that routes through `main.js`'s `setTab()`/`PENDING_DETAIL` machinery, so the underlying tab actually switches to Coverage instead of leaving Organizations rendered behind a Coverage-tab hash. It also stashes `{ tab: 'organizations', name: org.name }` in `S.nav.backTo` (`state.js`) immediately beforehand, a one-shot breadcrumb the Coverage modal reads (and clears) to decide whether to show its own "← back" link.

Symmetrically, this modal itself shows a "← back" button (`org-modal-back`) when `S.nav.backTo` names `{ tab: 'coverage', name: <this org> }` — set by the Coverage modal's People-count link (see `coverage.js` below) just before navigating here.

When any contributor in the list was split across employers within the query window, an attribution note is shown explaining the discrepancy between the LFX total and the gitdm-attributed total.

For presets up to 1y (`30d`/`60d`/`90d`/`6m`/`1y`), the contributor list highlights who's active: a green left-border accent for contributors at or above the ≥10/month threshold (`activeThreshold()` in `utils.js`), yellow for contributors sitting exactly on the threshold, and a labeled divider (`renderActiveDivider()` in `render.js`) marking where the list drops below it. Since the list is already sorted by contributions descending, active contributors are always a contiguous prefix, so no reordering is needed — the divider is just spliced in at the split index. The "Contributors" stat tile follows the same rule: it relabels to "Active Contributors" and shows `active / total` (e.g. `26 / 48`) when the threshold applies. Longer presets (`2y`, `3y`, `all`) skip this treatment entirely — both the list and the tile fall back to the plain total.

Exports: `openOrgModal`, `closeOrgModal`

### `sig.js`
Opens when a row in the SIGs tab is clicked. Shows the repository name (linked to GitHub), contributor and organization counts for the selected period, and two scrollable lists — one for contributors (with affiliation) and one for organizations.

All data comes from the already-loaded `SIGS_CACHE`; no additional network requests are made.

In addition to the Contributors, Organizations, and Period stat tiles, the modal shows two dependency tiles — **Top Contributors** and **Org Dependency** — each computed locally from the per-repo leaderboard data via `computeDependency()` (`utils.js`). Each tile displays the minimum number of top entries accounting for ≥ 51% of contributions, their percentage share, and the count of remaining contributors/orgs.

Exports: `openSigModal`, `closeSigModal`

### `coverage.js`
Opens when a row in the Coverage tab is clicked. Shows the company logo/name, SIG and people counts for the selected period, and a collapsible (`<details>`) list of every SIG the company's contributors touched — each expands to the list of people (via `renderPersonRow(c, i, { sigStyle: true, showRole: true, repoName: repo.name })`), tagged with their maintainer/approver/triager role badge *scoped to that specific repo* (`roleForRepo()` in `roles.js`) — someone who's an approver on one SIG but has no role on another is only tagged where it's actually true. Wider than the other slide-in modals (`max-w-2xl`) to leave room for the role badges.

Contributor-to-company matching reuses `contributorsForOrg()` (`attribution.js`); the per-SIG breakdown comes from `sigDetailsForHandles()` (`cache.js`), which requires `SIGS_CACHE` to already be loaded (done eagerly by the Coverage tab before this modal can open).

The "People" stat tile is rendered as a "N →" `<button>` into the Organizations modal's full contributor/role breakdown for this org — same hash-navigation approach and button-not-div rationale as the Repositories link in `org.js` (and, unlike that link, always available here with no gate check of its own: reaching this modal at all already implies the cache-backed "All platforms" data the Organizations tab needs too — see the next paragraph for why that invariant actually holds). Clicking it stashes `{ tab: 'coverage', name: org.name }` in `S.nav.backTo` before navigating to `#organizations/<timeframe>/<org name>`.

That "always available" assumption depends on `openCoverageModal()` itself never being called under an unsupported platform. The direct route (a Coverage-tab row click) already guarantees this — rows only render when `loadCoverage()`'s own gate passes. The less obvious route is a `#coverage/...` hash resolving through `main.js`'s `resolvePendingDetail()` (e.g. this same Repositories link, or browser back/forward): that function checks `coverageAvailable()` (exported from `tabs/coverage.js`) before opening the modal, so a stale or bookmarked link under a non-"all" platform renders the tab's own empty state instead of popping the modal open over it.

If `S.nav.backTo` names `{ tab: 'organizations', name: <this org> }` (set by the org modal's repo-count link just before navigating here — see `org.js` above), a "← back" button appears in the header; clicking it hash-navigates back to `#organizations/<timeframe>/<org name>`, which switches the tab back and reopens that org's modal via the same `PENDING_DETAIL` mechanism. `S.nav.backTo` is read once and cleared on every open, so a direct row click on the Coverage tab never shows a stale back link.

Exports: `openCoverageModal`, `closeCoverageModal`
