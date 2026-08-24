import { SIGS_CACHE, S } from '../state.js';
import { el, num, show, hide, computeDependency, dependencyColor } from '../utils.js';
import { loadSigsCache } from '../cache.js';
import { toggleSort, sortRows, updateSortIndicators } from '../sort.js';

export async function loadSigs() {
  if (SIGS_CACHE !== null) {
    renderSigsList();
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'sigs' }));
    return;
  }

  show('sigs-loading'); hide('sigs-table-wrap'); hide('sigs-empty');
  await loadSigsCache();

  if (!SIGS_CACHE?.periods) {
    hide('sigs-loading'); show('sigs-empty');
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'sigs' }));
    return;
  }

  renderSigsList();
  document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'sigs' }));
}

export function renderSigsList() {
  const period = SIGS_CACHE?.periods?.[S.preset];

  if (!period) {
    hide('sigs-loading'); hide('sigs-table-wrap'); show('sigs-empty');
    return;
  }

  const q = el('sigs-search')?.value.toLowerCase().trim() ?? '';

  const base = Object.entries(period)
    .map(([repo, data]) => ({
      repo,
      contributors: data.contributors?.total ?? 0,
      organizations: data.organizations?.total ?? 0,
    }))
    .filter(e => e.contributors > 0);

  // Bar width is always relative to the biggest SIG by contributor count, regardless
  // of which column the table is currently sorted by.
  const maxC = base.reduce((m, e) => Math.max(m, e.contributors), 1);

  // The '#' column always shows the repo's true rank (by contributor count, the tab's
  // natural order) — not its position in whatever column the table is currently
  // sorted/searched by. #1 stays #1 regardless of reordering, so rank is assigned here,
  // before the display sort below reorders the array.
  [...base].sort((a, b) => b.contributors - a.contributors).forEach((e, i) => { e.rank = i + 1; });

  const allEntries = sortRows(base, 'sigs', sigsAccessor);

  const entries = q ? allEntries.filter(e => e.repo.toLowerCase().includes(q)) : allEntries;

  el('sigs-total-label').textContent = q ? `${entries.length} matches` : `${entries.length} active repo${entries.length === 1 ? '' : 's'}`;

  el('sigs-tbody').innerHTML = entries.map((e) => {
    const barW = Math.round((e.contributors / maxC) * 100);

    // Compute contributor & org dependency for the health color bar.
    // Take the worse of the two colors — if either contributors or orgs are
    // highly concentrated, the SIG is at risk.
    const repoData = period[e.repo];
    const contribDep = computeDependency(repoData?.contributors?.data);
    const orgDep = computeDependency(repoData?.organizations?.data);
    const contribColor = dependencyColor(contribDep?.topPercentage, contribDep?.topCount);
    const orgColor = dependencyColor(orgDep?.topPercentage, orgDep?.topCount);
    const color = contribColor === 'red' || orgColor === 'red' ? 'red'
      : contribColor === 'yellow' || orgColor === 'yellow' ? 'yellow'
      : (contribColor || orgColor);
    const barColor = color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-500' : color === 'red' ? 'bg-red-500' : 'bg-slate-300 dark:bg-gray-700';
    const healthLabel = color === 'green' ? 'Well distributed' : color === 'yellow' ? 'Moderate concentration' : color === 'red' ? 'High concentration' : 'No data';

    return `
      <tr class="sig-row border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors"
          data-repo="${e.repo}" title="Click to see contributors &amp; organizations">
        <td class="px-4 py-2.5 text-slate-500 dark:text-gray-400 text-xs">${e.rank}</td>
        <td class="px-4 py-2.5">
          <div class="flex items-center gap-2">
            <span class="w-1 h-4 rounded-full ${barColor} shrink-0" title="${healthLabel}"></span>
            <span class="text-sm font-medium text-slate-900 dark:text-gray-100">${e.repo}</span>
          </div>
        </td>
        <td class="px-4 py-2.5 text-right">
          <div class="text-sm font-mono">${num(e.contributors)}</div>
        </td>
        <td class="px-4 py-2.5 text-right text-sm text-slate-500 dark:text-gray-400">${num(e.organizations)}</td>
      </tr>`;
  }).join('');

  hide('sigs-loading'); hide('sigs-empty'); show('sigs-table-wrap');
  updateSortIndicators('#sigs-table-wrap', 'sigs');
}

function sigsAccessor(e, key) {
  switch (key) {
    case 'repo':          return e.repo;
    case 'contributors':  return e.contributors;
    case 'organizations': return e.organizations;
    default:              return 0;
  }
}

export function onSigsSort(key) {
  toggleSort('sigs', key);
  renderSigsList();
}

function clearSearch(inputId, onSearch) {
  el(inputId).value = '';
  onSearch();
  el(inputId).focus();
}

export function onSigsSearch() {
  const q = el('sigs-search').value;
  el('sigs-search-clear').classList.toggle('hidden', !q.trim());
  renderSigsList();
}

export const clearSigsSearch = () => clearSearch('sigs-search', onSigsSearch);
