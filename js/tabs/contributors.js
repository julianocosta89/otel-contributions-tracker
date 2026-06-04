import { S } from '../state.js';
import { el, num, pct, show, hide, deltaCell } from '../utils.js';
import { PAGE_SIZE } from '../config.js';
import { usingCache, cacheData } from '../cache.js';
import { liveApi } from '../api.js';
import { affiliationFor } from '../affiliations.js';
import { roleBadge } from '../roles.js';
import { personPlaceholder, companyCell } from '../render.js';
import { showError } from '../error.js';
import { updatePager } from '../ui.js';

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
      renderContribTable(data.data, offset);
      updatePager('contrib', S.pages.contributors, Math.ceil(data.meta.total / PAGE_SIZE));
    }
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'contributors' }));
  } catch (e) {
    showError(e.message);
    hide('contrib-loading');
  }
}

function renderContribPage() {
  const page     = S.pages.contributors;
  const slice    = S.contrib.filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const q        = el('contributor-search').value.trim();

  let ranks = null;
  if (q && usingCache()) {
    const allData = cacheData().contributors.data;
    const rankMap = new Map(allData.map((c, i) => [c, i + 1]));
    ranks = slice.map(c => rankMap.get(c) ?? 0);
  }

  renderContribTable(slice, startIdx, ranks);
  updatePager('contrib', page, Math.ceil(S.contrib.filtered.length / PAGE_SIZE));
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
    const company = companyCell(c, affiliation, gitdmUrl);
    const barW = Math.min(100, (c.percentage || 0) * 6).toFixed(0);
    return `
      <tr class="contrib-row border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors" data-idx="${i}" title="Click to see repositories">
        <td class="px-4 py-2.5 text-slate-300 dark:text-gray-600 text-xs">${rank}</td>
        <td class="px-4 py-2.5">
          <div class="flex items-center gap-2.5">
            ${c.avatar ? `<img src="${c.avatar}" class="w-7 h-7 rounded-full shrink-0" onerror="this.style.display='none'">` : personPlaceholder('w-7 h-7')}
            <div>
              <div class="text-sm font-medium leading-tight">${c.name}</div>
              <div class="text-xs text-slate-400 dark:text-gray-500">${handles}</div>
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
    renderContribTable(filtered, 0);
    el('contrib-page-info').textContent = q ? `${filtered.length} matches on this page` : '';
  }
}
