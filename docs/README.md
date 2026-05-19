# docs/

This directory contains standalone HTML pages that provide supplementary explanations for metrics and features used in the OTel Contributions Tracker. Pages are linked from `index.html` at the points where users need more context than a tooltip can provide.

## Pages

### `concentration.html`

Explains the Contribution Concentration metric shown in the app's Concentration tab.

**What it covers:**

- **What the metric measures** — whether a company's OpenTelemetry contributions come from many contributors or just one or two. High concentration means higher exposure to contributor churn.
- **The HHI formula** — the Herfindahl-Hirschman Index, calculated as the sum of squared contributor share percentages (`HHI = Σ sᵢ²`). Ranges from ~0 (perfectly distributed) to 10,000 (single contributor holds everything).
- **Classification thresholds** — calibrated against actual OTel top-10 company data:
  - `HHI < 1,500` — Distributed (healthy)
  - `1,500 – 3,000` — Moderate
  - `HHI > 3,000` — Concentrated (high dependency risk)
- **Limitations** — coverage check logic (the 30% threshold below which the tile shows "Not enough GitHub data"), GitHub-only scope of the contributor cache, affiliation accuracy caveats, and snapshot-in-time behavior.

**Why it exists:** the HHI calculation and the 30% coverage fallback are non-obvious. This page gives users enough context to interpret the label correctly and understand when it may be unreliable.

## Adding new pages

Follow the same pattern as `concentration.html`:

1. Create a self-contained HTML file — no build step, no external JS bundles.
2. Load Tailwind CSS from CDN: `<script src="https://cdn.tailwindcss.com"></script>`
3. Use the dark theme (`bg-gray-950 text-gray-300`) to match the app.
4. Include a "← Back to tracker" link pointing to `../index.html` at the top of the page.
5. Link to the new page from `index.html` at the relevant UI location.

There is no routing or shared layout — each file is fully standalone.
