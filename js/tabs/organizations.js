import { S } from '../state.js';
import { el, num, pct, show, hide, deltaCell } from '../utils.js';
import { PAGE_SIZE } from '../config.js';
import { usingCache, cacheData } from '../cache.js';
import { liveApi } from '../api.js';
import { orgMatchesSearch, resolveOrgLogo } from '../companies.js';
import { orgPlaceholder } from '../render.js';
import { calcOrgConcentration, contributorsForOrg } from '../attribution.js';
import { showError } from '../error.js';
import { updatePager } from '../ui.js';
import { toggleSort, sortRows, isDefaultSort, updateSortIndicators } from '../sort.js';

export async function loadOrganizations() {
  show('orgs-loading'); hide('orgs-table-wrap');

  try {
    const cached = usingCache();
    const data   = cached ? cacheData() : null;
    if (cached) {
      const all = data.organizations.data;
      S.orgs.total = data.organizations.total;
      const q = el('org-search').value.toLowerCase().trim();
      S.orgs.filtered = q
        ? all.filter(o => orgMatchesSearch(o.name, q))
        : all;
      el('orgs-total-label').textContent = q
        ? `${S.orgs.filtered.length} matches`
        : `${num(S.orgs.total)} total`;
      renderOrgsPage();
    } else {
      const offset = S.pages.organizations * PAGE_SIZE;
      const page   = await liveApi('contributors/organization-leaderboard', { offset, limit: PAGE_SIZE });
      S.orgs.filtered = page.data;
      S.orgs.total    = page.meta.total;
      el('orgs-total-label').textContent = `${num(page.meta.total)} total`;
      renderOrgsTable(page.data, offset);
      updatePager('orgs', S.pages.organizations, Math.ceil(page.meta.total / PAGE_SIZE));
    }
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'organizations' }));

  } catch (e) {
    showError(e.message);
    hide('orgs-loading');
  }
}

function orgAccessor(o, key) {
  switch (key) {
    case 'name':          return o.name || '';
    case 'contributions': return o.contributions || 0;
    case 'delta':         return o.previousContributions ? (o.contributions - o.previousContributions) / o.previousContributions : 0;
    default:              return 0;
  }
}

export function onOrgSort(key) {
  toggleSort('organizations', key);
  S.pages.organizations = 0;
  if (usingCache()) renderOrgsPage();
}

function renderOrgsPage() {
  const page = S.pages.organizations;

  const list  = isDefaultSort('organizations') ? S.orgs.filtered : sortRows(S.orgs.filtered, 'organizations', orgAccessor);
  const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // The '#' column always shows the org's true leaderboard rank (by contributions,
  // the tab's natural order) — not its position in whatever column the table is
  // currently sorted/searched by. #1 stays #1 regardless of reordering.
  let ranks = null;
  if (usingCache()) {
    const allData = cacheData().organizations.data;
    const rankMap = new Map(allData.map((o, i) => [o, i + 1]));
    ranks = slice.map(o => rankMap.get(o) ?? 0);
  }

  renderOrgsTable(slice, page * PAGE_SIZE, ranks);
  updatePager('orgs', page, Math.ceil(list.length / PAGE_SIZE));
  updateSortIndicators('#orgs-table-wrap', 'organizations');
}

function concentrationCell(orgName, orgTotal) {
  const cached = usingCache();
  if (!cached) return `<td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-gray-400">—</td>`;
  const r = calcOrgConcentration(contributorsForOrg(orgName), orgTotal);
  if (r.status === 'limited') return `<td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-gray-400">—</td>`;
  const dot   = r.color === 'green' ? 'bg-green-500'  : r.color === 'yellow' ? 'bg-yellow-500'  : 'bg-red-500';
  const label = r.color === 'green' ? 'text-green-700 dark:text-green-400' : r.color === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  return `<td class="px-4 py-2.5 text-right">
    <span class="inline-flex items-center gap-1.5 justify-end">
      <span class="w-1.5 h-1.5 rounded-full ${dot} shrink-0"></span>
      <span class="text-xs ${label}">${r.label}</span>
    </span>
  </td>`;
}

export function renderOrgsTable(rows, baseOffset, ranks) {
  el('orgs-tbody')._rows = rows;
  el('orgs-tbody').innerHTML = rows.map((o, i) => {
    const rank = ranks ? ranks[i] : baseOffset + i + 1;
    return `
      <tr class="org-row border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors" data-idx="${i}" title="Click to see contributors & repositories">
        <td class="px-4 py-2.5 text-slate-500 dark:text-gray-400 text-xs">${rank}</td>
        <td class="px-4 py-2.5">
          <div class="flex items-center gap-2">
            ${resolveOrgLogo(o) ? `<img src="${resolveOrgLogo(o)}" alt="" class="w-6 h-6 rounded object-contain shrink-0" onerror="this.style.display='none'">` : orgPlaceholder('w-6 h-6')}
            <span class="text-sm">${o.name}</span>
          </div>
        </td>
        <td class="px-4 py-2.5 text-right">
          <div class="text-sm font-mono">${num(o.contributions)}</div>
        </td>
        ${deltaCell(o.contributions, o.previousContributions)}
        <td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-gray-400">${pct(o.percentage, 2)}</td>
        ${concentrationCell(o.name, o.contributions)}
      </tr>`;
  }).join('');
  hide('orgs-loading'); show('orgs-table-wrap');
}

function clearSearch(inputId, onSearch) {
  el(inputId).value = '';
  onSearch();
  el(inputId).focus();
}

export function onOrgSearch() {
  const cached = usingCache();
  const data   = cached ? cacheData() : null;
  const q = el('org-search').value.toLowerCase().trim();
  el('org-search-clear').classList.toggle('hidden', !q);
  S.pages.organizations = 0;
  if (cached) {
    const all = data.organizations.data;
    S.orgs.filtered = q ? all.filter(o => orgMatchesSearch(o.name, q)) : all;
    el('orgs-total-label').textContent = q ? `${S.orgs.filtered.length} matches` : `${num(S.orgs.total)} total`;
    renderOrgsPage();
  }
}

export const clearOrgSearch = () => clearSearch('org-search', onOrgSearch);
