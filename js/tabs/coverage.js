import { S, SIGS_CACHE } from '../state.js';
import { el, num, show, hide } from '../utils.js';
import { PAGE_SIZE } from '../config.js';
import { usingCache, cacheData, loadSigsCache, sigDetailsForHandles } from '../cache.js';
import { orgMatchesSearch, resolveOrgLogo, normCompany } from '../companies.js';
import { orgPlaceholder } from '../render.js';
import { contributorsForOrg, companyMatchesOrgNormalized } from '../attribution.js';
import { affiliationFor } from '../affiliations.js';
import { roleFor } from '../roles.js';
import { updatePager } from '../ui.js';
import { toggleSort, sortRows, isDefaultSort, updateSortIndicators } from '../sort.js';

// data/sigs.json is always fetched all-platform (scripts/fetch-sigs.mjs), unlike
// cacheData() which is filtered per-platform — combining the two under a specific
// platform filter would silently mix mismatched-scope numbers in the same row.
const EMPTY_PLATFORM =
  'Coverage only supports "All platforms".<br>' +
  '<span class="text-xs text-slate-500 dark:text-gray-400">SIG data (<code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-gray-400">data/sigs.json</code>) ' +
  'isn\'t split by platform, so per-platform numbers here would be misleading. Switch the platform filter back to "All platforms".</span>';

const EMPTY_NO_DATA =
  'Coverage data not available.<br>' +
  '<span class="text-xs text-slate-500 dark:text-gray-400">Requires <code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-gray-400">data/cache.json</code> ' +
  'and <code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-gray-400">data/sigs.json</code> — run ' +
  '<code class="bg-slate-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-gray-400">make fetch-data</code>.</span>';

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
  document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'coverage' }));
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

function statsFromContribs(contribs) {
  const handles  = new Set(contribs.flatMap(c => (c.githubHandleArray || []).map(h => h.toLowerCase())));
  const sigCount = sigDetailsForHandles(handles)?.length ?? 0;
  const maintainers = contribs.filter(c => roleFor(c.githubHandleArray) === 'maintainer').length;
  const approvers   = contribs.filter(c => roleFor(c.githubHandleArray) === 'approver').length;
  return { sigCount, maintainers, approvers };
}

function statsForOrg(orgName) {
  return statsFromContribs(contributorsForOrg(orgName));
}

// Sorting by SIGs/Maintainers/Approvers needs every org's counts up front (not just
// the visible page), which means matching every contributor against every org.
// contributorsForOrg() re-normalizes both the org name and each contributor's company
// string on every single call; doing that once per contributor here instead — rather
// than once per (org, contributor) pair — is what keeps this from redoing ~1200x more
// string-normalization work than necessary across ~1200 orgs × ~5300 contributors.
// Memoized per `orgs` array reference (stable per preset+platform), so paging/toggling
// direction after the first computation is instant.
const _statsCache = new WeakMap();

function buildContribIndex(contribs) {
  return contribs.map(c => {
    if (c.attributedContributions?.length) {
      return { c, norms: c.attributedContributions.map(a => normCompany(a.company)) };
    }
    const aff = affiliationFor(c.githubHandleArray);
    return { c, norms: aff ? [normCompany(aff.company)] : [] };
  });
}

function statsForAllOrgs(orgs, contribs) {
  const cached = _statsCache.get(orgs);
  if (cached) return cached;
  const index = buildContribIndex(contribs);
  const map = new Map();
  for (const o of orgs) {
    const on = normCompany(o.name);
    const matched = index
      .filter(({ norms }) => norms.some(cn => companyMatchesOrgNormalized(cn, on)))
      .map(({ c }) => c);
    map.set(o.name, statsFromContribs(matched));
  }
  _statsCache.set(orgs, map);
  return map;
}

const STATS_SORT_KEYS = new Set(['sigCount', 'maintainers', 'approvers']);

function coverageAccessor(statsMap) {
  return (o, key) => {
    switch (key) {
      case 'name':          return o.name || '';
      case 'contributions': return o.contributions || 0;
      case 'sigCount':      return statsMap.get(o.name)?.sigCount ?? 0;
      case 'maintainers':   return statsMap.get(o.name)?.maintainers ?? 0;
      case 'approvers':     return statsMap.get(o.name)?.approvers ?? 0;
      default:              return 0;
    }
  };
}

export function onCoverageSort(key) {
  toggleSort('coverage', key);
  S.pages.coverage = 0;
  if (coverageAvailable()) renderCoveragePage();
}

function renderCoveragePage() {
  const page = S.pages.coverage;
  const { key } = S.sort.coverage;

  // Only compute the full-dataset stats map when sorting actually needs it (name/
  // contributions sort re-use the already-cheap per-row statsForOrg() at render time).
  const statsMap = STATS_SORT_KEYS.has(key)
    ? statsForAllOrgs(cacheData().organizations.data, cacheData().contributors.data)
    : null;

  const list = isDefaultSort('coverage')
    ? S.coverage.filtered
    : sortRows(S.coverage.filtered, 'coverage', coverageAccessor(statsMap ?? new Map()));

  const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // The '#' column always shows the company's true rank (by contributions, the tab's
  // natural order) — not its position in whatever column the table is currently
  // sorted/searched by. #1 stays #1 regardless of reordering.
  const allData = cacheData().organizations.data;
  const rankMap = new Map(allData.map((o, i) => [o, i + 1]));
  const ranks = slice.map(o => rankMap.get(o) ?? 0);

  renderCoverageTable(slice, page * PAGE_SIZE, statsMap, ranks);
  updatePager('coverage', page, Math.ceil(list.length / PAGE_SIZE));
  updateSortIndicators('#coverage-table-wrap', 'coverage');
}

export function renderCoverageTable(rows, baseOffset, statsMap, ranks) {
  el('coverage-tbody')._rows = rows;
  el('coverage-tbody').innerHTML = rows.map((o, i) => {
    const logo = resolveOrgLogo(o);
    const { sigCount, maintainers, approvers } = statsMap?.get(o.name) ?? statsForOrg(o.name);
    const rank = ranks ? ranks[i] : baseOffset + i + 1;
    return `
      <tr class="coverage-row border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors" data-idx="${i}" title="Click to see SIG breakdown">
        <td class="px-4 py-2.5 text-slate-500 dark:text-gray-400 text-xs">${rank}</td>
        <td class="px-4 py-2.5">
          <div class="flex items-center gap-2">
            ${logo ? `<img src="${logo}" alt="" class="w-6 h-6 rounded object-contain shrink-0" onerror="this.style.display='none'">` : orgPlaceholder('w-6 h-6')}
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
