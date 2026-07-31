import { S } from '../state.js';
import { el, num, pct, show, hide, deltaCell } from '../utils.js';
import { PAGE_SIZE } from '../config.js';
import { usingCache, cacheData } from '../cache.js';
import { liveApi } from '../api.js';
import { affiliationFor, affiliationsInWindow } from '../affiliations.js';
import { roleBadge } from '../roles.js';
import { personPlaceholder, companyCell, primaryCompanyName } from '../render.js';
import { showError } from '../error.js';
import { updatePager } from '../ui.js';
import { toggleSort, sortRows, isDefaultSort, updateSortIndicators } from '../sort.js';

export async function loadContributors() {
  show('contrib-loading'); hide('contrib-table-wrap');

  try {
    const cached = usingCache();
    const data   = cached ? cacheData() : null;
    if (cached) {
      const all = data.contributors.data;
      S.contrib.total = data.contributors.total;
      const q = el('contributor-search').value.toLowerCase().trim();
      S.contrib.filtered = q
        ? all.filter(c =>
            c.name?.toLowerCase().includes(q) ||
            (c.githubHandleArray || []).some(h => h.toLowerCase().includes(q)))
        : all;
      el('contrib-total-label').textContent = q
        ? `${S.contrib.filtered.length} matches`
        : `${num(S.contrib.total)} total`;
      renderContribPage();
    } else {
      const offset = S.pages.contributors * PAGE_SIZE;
      const data   = await liveApi('contributors/contributor-leaderboard', { offset, limit: PAGE_SIZE });
      S.contrib.filtered = data.data;
      S.contrib.total    = data.meta.total;
      el('contrib-total-label').textContent = `${num(data.meta.total)} total`;
      // Each page reload (e.g. via changePage()) re-fetches raw API order — re-apply
      // whatever sort is active instead of losing it the moment the page changes.
      renderContribTable(sortedContribList(), offset);
      updatePager('contrib', S.pages.contributors, Math.ceil(data.meta.total / PAGE_SIZE));
      updateSortIndicators('#contrib-table-wrap', 'contributors');
    }
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'contributors' }));
  } catch (e) {
    showError(e.message);
    hide('contrib-loading');
  }
}

// Sort accessor — 'delta' mirrors deltaCell()'s % change; contributors with no prior
// period count as flat (0) rather than sorting to an extreme. 'company' mirrors
// exactly what companyCell() renders (via primaryCompanyName()) rather than always
// the contributor's present-day affiliation, so split-affiliation rows sort by the
// same company text shown on screen.
function contribAccessor(c, key) {
  switch (key) {
    case 'name':          return c.name || '';
    case 'contributions': return c.contributions || 0;
    case 'delta':         return c.previousContributions ? (c.contributions - c.previousContributions) / c.previousContributions : 0;
    case 'company': {
      const affiliation = affiliationFor(c.githubHandleArray);
      const ranges = c.attributedContributions?.length > 1
        ? null
        : affiliationsInWindow(c.githubHandleArray, S.filters.startDate, S.filters.endDate);
      return primaryCompanyName(c, affiliation, ranges);
    }
    default:              return 0;
  }
}

function sortedContribList(list = S.contrib.filtered) {
  return isDefaultSort('contributors') ? list : sortRows(list, 'contributors', contribAccessor);
}

export function onContribSort(key) {
  toggleSort('contributors', key);
  if (usingCache()) {
    S.pages.contributors = 0;
    renderContribPage();
  } else {
    // Live API: only the current page is loaded (no full dataset to rank/page against),
    // so just reorder what's already on screen instead of silently no-op'ing.
    renderContribTable(sortedContribList(), S.pages.contributors * PAGE_SIZE);
    updateSortIndicators('#contrib-table-wrap', 'contributors');
  }
}

function renderContribPage() {
  const page = S.pages.contributors;

  const list = sortedContribList();
  const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;

  // The '#' column always shows the contributor's true leaderboard rank (by
  // contributions, the tab's natural order) — not their position in whatever column
  // the table is currently sorted/searched by. #1 stays #1 regardless of reordering.
  let ranks = null;
  if (usingCache()) {
    const allData = cacheData().contributors.data;
    const rankMap = new Map(allData.map((c, i) => [c, i + 1]));
    ranks = slice.map(c => rankMap.get(c) ?? 0);
  }

  renderContribTable(slice, startIdx, ranks);
  updatePager('contrib', page, Math.ceil(list.length / PAGE_SIZE));
  updateSortIndicators('#contrib-table-wrap', 'contributors');
}

export function renderContribTable(rows, baseOffset, ranks) {
  // Store rows on the table element so click handler can look up contributor data
  el('contrib-tbody')._rows = rows;

  el('contrib-tbody').innerHTML = rows.map((c, i) => {
    const rank    = ranks ? ranks[i] : baseOffset + i + 1;
    const handles = (c.githubHandleArray || []).slice(0, 2)
      .map(h => `<a href="https://github.com/${h}" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300" onclick="event.stopPropagation()">@${h}</a>`)
      .join(', ');
    const roles = roleBadge(c.githubHandleArray, true);
    const affiliation = affiliationFor(c.githubHandleArray);
    const gitdmUrl = affiliation?.file
      ? `https://github.com/cncf/gitdm/blob/master/developers_affiliations${affiliation.file}.txt#L${affiliation.lineStart}${affiliation.lineEnd !== affiliation.lineStart ? `-L${affiliation.lineEnd}` : ''}`
      : 'https://github.com/cncf/gitdm';
    const ranges = c.attributedContributions?.length > 1
      ? null
      : affiliationsInWindow(c.githubHandleArray, S.filters.startDate, S.filters.endDate);
    const company = companyCell(c, affiliation, gitdmUrl, ranges);
    const barW = Math.min(100, (c.percentage || 0) * 6).toFixed(0);
    return `
      <tr class="contrib-row border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors" data-idx="${i}" title="Click to see repositories">
        <td class="px-4 py-2.5 text-slate-500 dark:text-gray-400 text-xs">${rank}</td>
        <td class="px-4 py-2.5">
          <div class="flex items-center gap-2.5">
            ${c.avatar ? `<img src="${c.avatar}" alt="" class="w-7 h-7 rounded-full shrink-0" onerror="this.style.display='none'">` : personPlaceholder('w-7 h-7')}
            <div>
              <div class="text-sm font-medium leading-tight">${c.name}</div>
              <div class="text-xs text-slate-600 dark:text-gray-400">${handles}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-2.5 text-right">
          <div class="text-sm font-mono">${num(c.contributions)}</div>
        </td>
        ${deltaCell(c.contributions, c.previousContributions)}
        <td class="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-gray-400">${pct(c.percentage, 2)}</td>
        <td class="px-4 py-2.5 text-xs text-slate-700 dark:text-gray-300">${company}</td>
        <td class="px-4 py-2.5 text-xs">${roles}</td>
      </tr>`;
  }).join('');
  hide('contrib-loading'); show('contrib-table-wrap');
}

function clearSearch(inputId, onSearch) {
  el(inputId).value = '';
  onSearch();
  el(inputId).focus();
}

export const clearContribSearch = () => clearSearch('contributor-search', onContribSearch);

export function onContribSearch() {
  const cached = usingCache();
  const data   = cached ? cacheData() : null;
  const q = el('contributor-search').value.toLowerCase().trim();
  el('contrib-search-clear').classList.toggle('hidden', !q);
  S.pages.contributors = 0;

  if (cached) {
    // Search across ALL cached contributors instantly
    S.contrib.filtered = q
      ? data.contributors.data.filter(c =>
          c.name?.toLowerCase().includes(q) ||
          (c.githubHandleArray || []).some(h => h.toLowerCase().includes(q)))
      : data.contributors.data;
    el('contrib-total-label').textContent = q
      ? `${S.contrib.filtered.length} matches`
      : `${num(S.contrib.total)} total`;
    renderContribPage();
  } else {
    // Live API: only search current page
    const filtered = q
      ? S.contrib.filtered.filter(c =>
          c.name?.toLowerCase().includes(q) ||
          (c.githubHandleArray || []).some(h => h.toLowerCase().includes(q)))
      : S.contrib.filtered;
    renderContribTable(sortedContribList(filtered), 0);
    updateSortIndicators('#contrib-table-wrap', 'contributors');
    el('contrib-page-info').textContent = q ? `${filtered.length} matches on this page` : '';
  }
}
