import { S } from './state.js';
import { el, show, hide, today, daysAgo } from './utils.js';
import { setHash, pageDetail, timeframeHash, VALID_PRESETS } from './routing.js';
import { loadOverview } from './tabs/overview.js';
import { loadContributors } from './tabs/contributors.js';
import { loadOrganizations } from './tabs/organizations.js';
import { loadConcentration } from './tabs/concentration.js';
import { loadGeography } from './tabs/geography.js';
import { loadSigs } from './tabs/sigs.js';
export { showError, hideError } from './error.js';

document.addEventListener('themeChanged', () => reload());

export function updatePager(prefix, page, totalPages) {
  el(`${prefix}-page-info`).textContent = `Page ${page + 1} of ${totalPages}`;
  el(`${prefix}-prev`).disabled = page === 0;
  el(`${prefix}-next`).disabled = page >= totalPages - 1;
}

export function setTab(tab, { updateHash = true } = {}) {
  if (tab !== S.tab) {
    // Clear all search inputs when switching tabs
    [['contributor-search', 'contrib-search-clear'],
     ['org-search',         'org-search-clear'],
     ['sigs-search',        'sigs-search-clear']].forEach(([inputId, btnId]) => {
      el(inputId).value = '';
      el(btnId).classList.add('hidden');
    });
  }
  S.tab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  show(`tab-${tab}`);
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick') === `setTab('${tab}')`);
  });
  if (updateHash) setHash(tab, timeframeHash(S));
  loadTab(tab);
}

export function reload() {
  S.pages.contributors  = 0;
  S.pages.organizations = 0;
  loadTab(S.tab);
}

export function loadTab(tab) {
  ({ overview: loadOverview, contributors: loadContributors,
     organizations: loadOrganizations, concentration: loadConcentration,
     geography: loadGeography, sigs: loadSigs })[tab]?.();
}

export function changePage(type, delta) {
  S.pages[type] += delta;
  if (type === 'contributors') {
    setHash('contributors', timeframeHash(S), pageDetail(S.pages.contributors));
    loadContributors();
  }
  if (type === 'organizations') {
    setHash('organizations', timeframeHash(S), pageDetail(S.pages.organizations));
    loadOrganizations();
  }
}

export function setPreset(preset, { updateHash = true } = {}) {
  S.preset = preset;
  const days = { '30d': 30, '60d': 60, '90d': 90, '6m': 182, '1y': 365, '2y': 730, '3y': 1095 };
  S.filters.endDate = today();
  S.filters.startDate = preset === 'all' ? '2019-01-01' : daysAgo(days[preset]);

  document.querySelectorAll('.preset-btn').forEach(b => {
    const on = b.dataset.preset === preset;
    b.className = `preset-btn px-2.5 py-1 rounded-md transition-colors ${on ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`;
  });

  if (updateHash) setHash(S.tab, preset);

  reload();
}

// Applies a timeframe string from the URL hash without updating the hash itself.
// tab is used only when redirecting an invalid timeframe to correct the URL.
export function applyTimeframeFromHash(timeframe, tab = S.tab) {
  if (!timeframe) { setPreset('1y', { updateHash: false }); return; }
  if (VALID_PRESETS.includes(timeframe)) {
    setPreset(timeframe, { updateHash: false });
  } else if (/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(timeframe)) {
    const [start, end] = timeframe.split('..');
    S.preset            = 'custom';
    S.filters.startDate = start;
    S.filters.endDate   = end;
    document.querySelectorAll('.preset-btn').forEach(b => {
      b.className = 'preset-btn px-2.5 py-1 rounded-md text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors';
    });
    reload();
  } else {
    // Unknown timeframe — silently redirect to 1y
    setPreset('1y', { updateHash: false });
    setHash(tab, '1y');
  }
}

export function onFilterChange() {
  S.filters.platform = el('platform').value;
  reload();
}
