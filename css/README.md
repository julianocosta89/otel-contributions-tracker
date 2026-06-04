# css/

Contains the single stylesheet for the app.

## `app.css`

Extracted from the original inline `<style>` block in `index.html`. Tailwind CSS handles almost everything; this file only covers the cases where Tailwind's utility classes fall short:

| Section | What it does |
|---|---|
| `.spinner` + `@keyframes spin` | Loading indicator used while data fetches are in-flight |
| `::-webkit-scrollbar` | Slim scrollbar (5 px) with dark-mode variant |
| `.tab-btn` / `.tab-btn.active` | Active-tab underline indicator and hover transitions |
| `.contrib-row` / `.org-row` / `.sig-row` | `cursor: pointer` for clickable table rows |
| `#*-modal-panel` / `.open` | Slide-in transition for the three right-panel modals (contributor, org, SIG) |
| `.role-badge-wrap` / `.role-tooltip*` | Fixed-position tooltip that escapes `overflow: hidden` containers |
| `input[type="date"]`, `select`, `option` | Explicit colors needed because Tailwind's `dark:` variants don't reach inside native form controls |
| `#error-toast` | Background colour override for the error notification |
