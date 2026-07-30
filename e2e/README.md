# e2e/

Playwright end-to-end tests for the web app. Unlike the rest of the repo, this is the one place that needs an `npm install` — see [Setup](#setup) below.

## Setup

```bash
make test-e2e-install   # npm ci + install Playwright's browser binaries (one-time / after upgrades)
make test-e2e            # run the full suite
```

`make test-e2e` boots a static server (`python3 -m http.server 3456`, same as `make serve`) itself via Playwright's `webServer` config — no need to run `make serve` separately first.

To run a single file or project while debugging:

```bash
npx playwright test e2e/navigation.spec.mjs
npx playwright test --project=chromium-small e2e/responsive.spec.mjs
npx playwright test --ui
npx playwright show-report
```

## Spec files

| File | Covers |
|------|--------|
| `navigation.spec.mjs` | Tab switching by click and by direct hash URL, timeframe presets, browser back/forward, deep-linked modal opening (including the nonexistent-entity case) |
| `accessibility.spec.mjs` | `@axe-core/playwright` scan (WCAG 2.0/2.1 A+AA) for every tab and every open modal type, in both light and dark theme |
| `responsive.spec.mjs` | Layout at 3 breakpoints (375×667 / 768×1024 / 1440×900) — nav usability, no page-level horizontal overflow, key controls visible, modal width |
| `modals.spec.mjs` | Open via row click, close via close-button/backdrop/Escape, search-then-open flow |

Shared code lives in `helpers.mjs` (the `TABS`/`MODALS`/`PRESETS` lists — the single source of truth both `navigation.spec.mjs` and `accessibility.spec.mjs` loop over) and `fixtures.mjs` (navigation + axe helpers).

## The `tabLoaded` wait convention

The app fetches ~54MB of committed JSON client-side before it can render, and every tab module dispatches a `tabLoaded` CustomEvent once it's done rendering (see `js/tabs/*.js`). `fixtures.mjs` registers a listener for this event via `page.addInitScript` and exposes `gotoTab(page, tab, opts)` / `clickTab(page, tab)`, which wait on it instead of a fixed timeout. Always use these helpers (or the same wait pattern) rather than `page.waitForTimeout()` — a fixed sleep is either too slow on a warm run or flaky on a cold one.

## Adding a new tab or modal

Add it to the `TABS` or `MODALS` array in `helpers.mjs` — both `navigation.spec.mjs` and `accessibility.spec.mjs` iterate those arrays, so a new entry is covered by both without further changes. Cross-browser (Chromium/Firefox/WebKit) coverage and the responsive breakpoints are configured once in `playwright.config.mjs` and apply automatically to every spec.

## Browser/viewport matrix

Configured in `../playwright.config.mjs`: `chromium`/`firefox`/`webkit` run every spec except `responsive.spec.mjs` at a standard desktop viewport; `chromium-small`/`chromium-medium`/`chromium-large` run only `responsive.spec.mjs`, one per breakpoint. Responsive checks are Chromium-only — layout overflow isn't meaningfully engine-specific, so tripling that matrix isn't worth the extra CI time.
