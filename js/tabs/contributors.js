import { S } from '../state.js';
import { el, num, pct, show, hide, deltaCell } from '../utils.js';
import { PAGE_SIZE } from '../config.js';
import { usingCache, cacheData } from '../cache.js';
import { affiliationFor, affiliationsInWindow } from '../affiliations.js';
import { roleBadge } from '../roles.js';
import { personPlaceholder, companyCell, primaryCompanyName } from '../render.js';
import { showError } from '../error.js';
import { updatePager } from '../ui.js';
import { toggleSort, sortRows, isDefaultSort, updateSortIndicators } from '../sort.js';

export async function loadContributors() {
  if (!usingCache()) {
    hide('contrib-loading'); hide('contrib-table-wrap'); show('contrib-empty');
    el('contrib-total-label').textContent = '';
    el('contrib-page-info').textContent = '';
    el('contrib-prev').disabled = true;
    el('contrib-next').disabled = true;
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'contributors' }));
    return;
  }
  hide('contrib-empty');
  show('contrib-loading'); hide('contrib-table-wrap');

  try {
    const all = cacheData().contributors.data;
    S.contrib.total = cacheData().contributors.total;
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

function sortedContribList() {
  return isDefaultSort('contributors') ? S.contrib.filtered : sortRows(S.contrib.filtered, 'contributors', contribAccessor);
}

export function onContribSort(key) {
  if (!usingCache()) return; // nothing loaded to sort
  toggleSort('contributors', key);
  S.pages.contributors = 0;
  renderContribPage();
}

function renderContribPage() {
  const page = S.pages.contributors;

  const list = sortedContribList();
  const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;

  // The '#' column always shows the contributor's true leaderboard rank (by
  // contributions, the tab's natural order) — not their position in whatever column
  // the table is currently sorted/searched by. #1 stays #1 regardless of reordering.
  const allData = cacheData().contributors.data;
  const rankMap = new Map(allData.map((c, i) => [c, i + 1]));
  const ranks = slice.map(c => rankMap.get(c) ?? 0);

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
  if (!usingCache()) return; // search box stays visible in the empty state; no-op instead of touching cacheData()
  const data = cacheData();
  const q = el('contributor-search').value.toLowerCase().trim();
  el('contrib-search-clear').classList.toggle('hidden', !q);
  S.pages.contributors = 0;

  S.contrib.filtered = q
    ? data.contributors.data.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        (c.githubHandleArray || []).some(h => h.toLowerCase().includes(q)))
    : data.contributors.data;
  el('contrib-total-label').textContent = q
    ? `${S.contrib.filtered.length} matches`
    : `${num(S.contrib.total)} total`;
  renderContribPage();
}
