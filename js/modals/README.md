# js/modals/

Right-panel slide-in modals. Each modal manages its own open/close animation and writes its deep-link hash via `js/routing.js`.

The slide-in transition is CSS-driven: the panel starts at `translateX(100%)` (off-screen right) and the `.open` class in `css/app.css` returns it to `translateX(0)`. Opening always does two nested `requestAnimationFrame` calls to ensure the browser has painted the visible state before the transition starts.

Delegated click handlers (`tr.contrib-row`, `tr.org-row`, `tr.sig-row`) and the global Escape key listener live in `main.js`, which calls the relevant `open*Modal` function.

## Modules

### `contributor.js`
Opens when a row in the Contributors tab is clicked. Shows avatar, handles, contribution count, share, company logo/name, role badge, and the list of repositories the contributor was active in during the selected period.

Repository data comes from `data/sigs.json` (via `reposFromCache`) when available; falls back to a live GitHub PR search (`api.js → fetchContribRepos`).

Exports: `openContribModal`, `closeContribModal`, `renderContribRepos`

### `org.js`
Opens when a row in the Organizations tab is clicked. Shows the org logo, contribution total, contributor count, maintainer/approver counts, an HHI concentration indicator, a scrollable contributor list with per-person share bars, and a repository breakdown.

Repository data comes from `data/sigs.json` (via `orgReposFromCache`) when available; falls back to aggregated GitHub PR searches across the top 8 contributors (`api.js → fetchOrgRepos`).

When any contributor in the list was split across employers within the query window, an attribution note is shown explaining the discrepancy between the LFX total and the gitdm-attributed total.

Exports: `openOrgModal`, `closeOrgModal`

### `sig.js`
Opens when a row in the SIGs tab is clicked. Shows the repository name (linked to GitHub), contributor and organization counts for the selected period, and two scrollable lists — one for contributors (with affiliation) and one for organizations.

All data comes from the already-loaded `SIGS_CACHE`; no additional network requests are made.

Exports: `openSigModal`, `closeSigModal`
