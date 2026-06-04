import { SIGS_CACHE, S } from '../state.js';
import { el, num, show, hide } from '../utils.js';
import { loadSigsCache } from '../cache.js';

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

  const allEntries = Object.entries(period)
    .map(([repo, data]) => ({
      repo,
      contributors: data.contributors?.total ?? 0,
      organizations: data.organizations?.total ?? 0,
    }))
    .filter(e => e.contributors > 0)
    .sort((a, b) => b.contributors - a.contributors)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const entries = q ? allEntries.filter(e => e.repo.toLowerCase().includes(q)) : allEntries;

  el('sigs-total-label').textContent = q ? `${entries.length} matches` : `${entries.length} active repo${entries.length === 1 ? '' : 's'}`;

  const maxC = allEntries[0]?.contributors || 1;
  el('sigs-tbody').innerHTML = entries.map((e) => {
    const barW = Math.round((e.contributors / maxC) * 100);
    return `
      <tr class="sig-row border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors"
          data-repo="${e.repo}" title="Click to see contributors &amp; organizations">
        <td class="px-4 py-2.5 text-slate-300 dark:text-gray-600 text-xs">${e.rank}</td>
        <td class="px-4 py-2.5">
          <div class="flex items-center gap-2">
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
