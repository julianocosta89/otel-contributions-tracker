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
Opens when a row in the Organizations tab is clicked. Shows the org logo, contribution total, contributor count, maintainer/approver counts, an HHI concentration indicator, a scrollable contributor list with per-person share bars, and a repository breakdown.

Repository data comes from `data/sigs.json` (via `orgReposFromCache`) when available; falls back to aggregated GitHub PR searches across the top 8 contributors (`api.js → fetchOrgRepos`).

When any contributor in the list was split across employers within the query window, an attribution note is shown explaining the discrepancy between the LFX total and the gitdm-attributed total.

For presets up to 1y (`30d`/`60d`/`90d`/`6m`/`1y`), the contributor list highlights who's active: a green left-border accent for contributors at or above the ≥2/month threshold (`activeThreshold()` in `utils.js`), yellow for contributors sitting exactly on the threshold, and a labeled divider (`renderActiveDivider()` in `render.js`) marking where the list drops below it. Since the list is already sorted by contributions descending, active contributors are always a contiguous prefix, so no reordering is needed — the divider is just spliced in at the split index. The "Contributors" stat tile follows the same rule: it relabels to "Active Contributors" and shows `active / total` (e.g. `26 / 48`) when the threshold applies. Longer presets (`2y`, `3y`, `all`) skip this treatment entirely — both the list and the tile fall back to the plain total.

Exports: `openOrgModal`, `closeOrgModal`

### `sig.js`
Opens when a row in the SIGs tab is clicked. Shows the repository name (linked to GitHub), contributor and organization counts for the selected period, and two scrollable lists — one for contributors (with affiliation) and one for organizations.

All data comes from the already-loaded `SIGS_CACHE`; no additional network requests are made.

Exports: `openSigModal`, `closeSigModal`

### `coverage.js`
Opens when a row in the Coverage tab is clicked. Shows the company logo/name, SIG and people counts for the selected period, and a collapsible (`<details>`) list of every SIG the company's contributors touched — each expands to the list of people (via `renderPersonRow(c, i, { sigStyle: true, showRole: true, repoName: repo.name })`), tagged with their maintainer/approver/triager role badge *scoped to that specific repo* (`roleForRepo()` in `roles.js`) — someone who's an approver on one SIG but has no role on another is only tagged where it's actually true. Wider than the other slide-in modals (`max-w-2xl`) to leave room for the role badges.

Contributor-to-company matching reuses `contributorsForOrg()` (`attribution.js`); the per-SIG breakdown comes from `sigDetailsForHandles()` (`cache.js`), which requires `SIGS_CACHE` to already be loaded (done eagerly by the Coverage tab before this modal can open).

Exports: `openCoverageModal`, `closeCoverageModal`
