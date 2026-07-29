import { S, SIGS_CACHE } from '../state.js';
import { el, num, show, hide } from '../utils.js';
import { PAGE_SIZE } from '../config.js';
import { usingCache, cacheData, loadSigsCache, sigDetailsForHandles } from '../cache.js';
import { orgMatchesSearch, resolveOrgLogo } from '../companies.js';
import { orgPlaceholder } from '../render.js';
import { contributorsForOrg } from '../attribution.js';
import { roleFor } from '../roles.js';
import { updatePager } from '../ui.js';

// data/sigs.json is always fetched all-platform (scripts/fetch-sigs.mjs), unlike
// cacheData() which is filtered per-platform — combining the two under a specific
// platform filter would silently mix mismatched-scope numbers in the same row.
const EMPTY_PLATFORM =
  'Coverage only supports "All platforms".<br>' +
  '<span class="text-xs text-slate-300 dark:text-gray-600">SIG data (<code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-gray-400">data/sigs.json</code>) ' +
  'isn\'t split by platform, so per-platform numbers here would be misleading. Switch the platform filter back to "All platforms".</span>';

const EMPTY_NO_DATA =
  'Coverage data not available.<br>' +
  '<span class="text-xs text-slate-300 dark:text-gray-600">Requires <code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-gray-400">data/cache.json</code> ' +
  'and <code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-gray-400">data/sigs.json</code> — run ' +
  '<code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-gray-400">make fetch-data</code>.</span>';

// Whether Coverage can render at all right now — mirrors the guards in loadCoverage()
// so onCoverageSearch() can bail out instead of touching cacheData() when it's unusable.
function coverageAvailable() {
  return S.filters.platform === 'all' && usingCache() && !!SIGS_CACHE?.periods;
}

// Centralizes the empty state so every early-return path also clears the stale
// total/matches label and resets the (still-visible, still-interactive-looking)
// search box — otherwise e.g. switching Platform away from "All platforms" would
// show the unsupported-platform message while a prior "1,204 total" lingered.
function showCoverageEmpty(message) {
  el('coverage-empty').innerHTML = message;
  el('coverage-total-label').textContent = '';
  el('coverage-search').value = '';
  el('coverage-search-clear').classList.add('hidden');
  hide('coverage-loading'); hide('coverage-table-wrap'); show('coverage-empty');
}

export async function loadCoverage() {
  show('coverage-loading'); hide('coverage-table-wrap'); hide('coverage-empty');

  if (S.filters.platform !== 'all') {
    showCoverageEmpty(EMPTY_PLATFORM);
    return;
  }

  if (!usingCache()) {
    showCoverageEmpty(EMPTY_NO_DATA);
    return;
  }

  await loadSigsCache();

  // Filters can change while data/sigs.json is loading (e.g. platform switched away
  // from "all" mid-await). Re-check before rendering so a slow-resolving call can't
  // clobber a newer, correctly-empty render with stale/mismatched-platform data.
  if (S.filters.platform !== 'all') {
    showCoverageEmpty(EMPTY_PLATFORM);
    return;
  }
  if (!usingCache() || !SIGS_CACHE?.periods) {
    showCoverageEmpty(EMPTY_NO_DATA);
    return;
  }

  const all = cacheData().organizations.data;
  S.coverage.total = all.length;
  const q = el('coverage-search').value.toLowerCase().trim();
  S.coverage.filtered = q ? all.filter(o => orgMatchesSearch(o.name, q)) : all;
  el('coverage-total-label').textContent = q ? `${S.coverage.filtered.length} matches` : `${num(S.coverage.total)} total`;

  renderCoveragePage();
  document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'coverage' }));
}

function statsForOrg(orgName) {
  const contribs = contributorsForOrg(orgName);
  const handles  = new Set(contribs.flatMap(c => (c.githubHandleArray || []).map(h => h.toLowerCase())));
  const sigCount = sigDetailsForHandles(handles)?.length ?? 0;
  const maintainers = contribs.filter(c => roleFor(c.githubHandleArray) === 'maintainer').length;
  const approvers   = contribs.filter(c => roleFor(c.githubHandleArray) === 'approver').length;
  return { sigCount, maintainers, approvers };
}

function renderCoveragePage() {
  const page  = S.pages.coverage;
  const slice = S.coverage.filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  renderCoverageTable(slice, page * PAGE_SIZE);
  updatePager('coverage', page, Math.ceil(S.coverage.filtered.length / PAGE_SIZE));
}

export function renderCoverageTable(rows, baseOffset) {
  el('coverage-tbody')._rows = rows;
  el('coverage-tbody').innerHTML = rows.map((o, i) => {
    const logo = resolveOrgLogo(o);
    const { sigCount, maintainers, approvers } = statsForOrg(o.name);
    return `
      <tr class="coverage-row border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors" data-idx="${i}" title="Click to see SIG breakdown">
        <td class="px-4 py-2.5 text-slate-300 dark:text-gray-600 text-xs">${baseOffset + i + 1}</td>
        <td class="px-4 py-2.5">
          <div class="flex items-center gap-2">
            ${logo ? `<img src="${logo}" class="w-6 h-6 rounded object-contain shrink-0" onerror="this.style.display='none'">` : orgPlaceholder('w-6 h-6')}
            <span class="text-sm">${o.name}</span>
          </div>
        </td>
        <td class="px-4 py-2.5 text-right">
          <div class="text-sm font-mono">${num(sigCount)}</div>
        </td>
        <td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-gray-400">${num(maintainers)}</td>
        <td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-gray-400">${num(approvers)}</td>
        <td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-gray-400">${num(o.contributions)}</td>
      </tr>`;
  }).join('');
  hide('coverage-loading'); hide('coverage-empty'); show('coverage-table-wrap');
}

function clearSearch(inputId, onSearch) {
  el(inputId).value = '';
  onSearch();
  el(inputId).focus();
}

export function onCoverageSearch() {
  if (!coverageAvailable()) return; // search box stays visible even in the empty state; no-op instead of touching cacheData()
  const q = el('coverage-search').value.toLowerCase().trim();
  el('coverage-search-clear').classList.toggle('hidden', !q);
  S.pages.coverage = 0;
  const all = cacheData().organizations.data;
  S.coverage.filtered = q ? all.filter(o => orgMatchesSearch(o.name, q)) : all;
  el('coverage-total-label').textContent = q ? `${S.coverage.filtered.length} matches` : `${num(S.coverage.total)} total`;
  renderCoveragePage();
}

export const clearCoverageSearch = () => clearSearch('coverage-search', onCoverageSearch);
