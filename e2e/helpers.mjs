// Single source of truth for which tabs/modals the e2e suite covers.
// Mirrors VALID_TABS in js/routing.js — extend both lists here when a new
// tab or modal type is added to the app.

export const TABS = ['overview', 'contributors', 'organizations', 'concentration', 'geography', 'sigs', 'coverage'];

export const PRESETS = ['30d', '60d', '90d', '6m', '1y', '2y', '3y', 'all'];

// Each entry describes how to open the modal from a tab that's already loaded,
// via a row click (the same delegated listener the app uses), rather than a
// hardcoded entity name — table contents change as data/*.json is refreshed.
export const MODALS = [
  { tab: 'contributors',  rowSelector: 'tr.contrib-row',   modalId: 'contrib-modal',   closeLabel: 'Close contributor details' },
  { tab: 'organizations', rowSelector: 'tr.org-row',       modalId: 'org-modal',       closeLabel: 'Close organization details' },
  { tab: 'sigs',          rowSelector: 'tr.sig-row',       modalId: 'sig-modal',       closeLabel: 'Close SIG details' },
  { tab: 'coverage',      rowSelector: 'tr.coverage-row',  modalId: 'coverage-modal',  closeLabel: 'Close coverage details' },
];
