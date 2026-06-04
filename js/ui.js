import { S } from './state.js';
import { el, show, hide, today, daysAgo } from './utils.js';
import { showCurrentSourceBadge, showSourceBadge } from './cache.js';
import { setHash, pageDetail } from './routing.js';
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
  if (updateHash) setHash(tab);
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
    setHash('contributors', pageDetail(S.pages.contributors));
    loadContributors();
  }
  if (type === 'organizations') {
    setHash('organizations', pageDetail(S.pages.organizations));
    loadOrganizations();
  }
}

export function setPreset(preset) {
  S.preset = preset;
  const days = { '30d': 30, '90d': 90, '6m': 182, '1y': 365, '2y': 730, '3y': 1095 };
  S.filters.endDate = today();
  S.filters.startDate = preset === 'all' ? '2019-01-01' : daysAgo(days[preset]);
  el('startDate').value = S.filters.startDate;
  el('endDate').value   = S.filters.endDate;

  document.querySelectorAll('.preset-btn').forEach(b => {
    const on = b.dataset.preset === preset;
    b.className = `preset-btn px-2.5 py-1 rounded-md transition-colors ${on ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`;
  });

  showCurrentSourceBadge();

  reload();
}

export function onDateChange() {
  S.preset            = 'custom';
  S.filters.startDate = el('startDate').value;
  S.filters.endDate   = el('endDate').value;
  document.querySelectorAll('.preset-btn').forEach(b => {
    b.className = 'preset-btn px-2.5 py-1 rounded-md text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors';
  });
  showSourceBadge('live');
  if (S.filters.startDate && S.filters.endDate) reload();
}

export function onFilterChange() {
  S.filters.platform = el('platform').value;
  showCurrentSourceBadge();
  reload();
}
