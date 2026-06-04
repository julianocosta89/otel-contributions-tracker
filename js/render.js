import { num, pct, shortYearMonth } from './utils.js';
import { affiliationFor } from './affiliations.js';
import { resolveOrgLogo } from './companies.js';

export const SVG_PERSON   = `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><rect width="24" height="24" rx="12" fill="#374151"/><circle cx="12" cy="9" r="3.5" fill="#9CA3AF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7H5z" fill="#9CA3AF"/></svg>`;
export const SVG_BUILDING = `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><rect width="24" height="24" rx="4" fill="#D1D5DB"/><rect x="7" y="3" width="10" height="16" fill="#4B5563"/><rect x="8.5" y="5.5" width="2.5" height="2" rx=".4" fill="#9CA3AF"/><rect x="13" y="5.5" width="2.5" height="2" rx=".4" fill="#9CA3AF"/><rect x="8.5" y="9" width="2.5" height="2" rx=".4" fill="#9CA3AF"/><rect x="13" y="9" width="2.5" height="2" rx=".4" fill="#9CA3AF"/><rect x="8.5" y="12.5" width="2.5" height="2" rx=".4" fill="#9CA3AF"/><rect x="13" y="12.5" width="2.5" height="2" rx=".4" fill="#9CA3AF"/><rect x="11" y="15.5" width="2" height="3.5" rx=".4" fill="#9CA3AF"/></svg>`;

export const personPlaceholder  = cls => `<span class="${cls} shrink-0 inline-block">${SVG_PERSON}</span>`;
export const orgPlaceholder     = cls => `<span class="${cls} shrink-0 inline-block">${SVG_BUILDING}</span>`;

// Renders a repo list into a modal's list element.
// unit: 'contribution' | 'PR'
// barColor: tailwind class for the progress bar
export function renderReposList({ repos, unit, barColor, listElId, note }) {
  if (!repos.length) return false;
  const maxCount = repos[0].count;
  const listEl = document.getElementById(listElId);
  listEl.innerHTML = repos.map(repo => {
    const barW    = Math.round((repo.count / maxCount) * 100);
    const label   = `${num(repo.count)} ${repo.count === 1 ? unit : unit + 's'}`;
    const href    = repo.url
      ? (repo.url.startsWith('https://') ? repo.url : `https://github.com/${repo.url}`)
      : repo.htmlUrl;
    return `
      <a href="${href}" target="_blank"
        class="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-200/50 dark:bg-gray-800/30 hover:bg-slate-200/80 dark:hover:bg-gray-800/60 transition-colors group">
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-gray-100 truncate transition-colors">${repo.name}</div>
        </div>
        <span class="text-xs text-slate-400 dark:text-gray-500 font-mono shrink-0">${label}</span>
        <svg class="w-3 h-3 text-slate-300 dark:text-gray-600 group-hover:text-slate-500 dark:text-gray-400 shrink-0 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>`;
  }).join('');
  if (note) {
    listEl.innerHTML += `<p class="text-xs text-slate-300 dark:text-gray-600 text-center pt-1">${note}</p>`;
  }
  return true;
}

// opts: { showAffiliation, orgTotal, sigStyle }
// sigStyle: use wider avatar, hover wrapper, affiliation div, and c.percentage instead of orgTotal ratio
export function renderPersonRow(c, i, opts = {}) {
  const handle = (c.githubHandleArray || [])[0];
  if (opts.sigStyle) {
    const aff = affiliationFor(c.githubHandleArray);
    return `
          <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-200/50 dark:hover:bg-gray-800/40 transition-colors">
            <span class="text-slate-300 dark:text-gray-600 text-xs w-5 shrink-0 text-right">${i + 1}</span>
            ${c.avatar
              ? `<img src="${c.avatar}" class="w-6 h-6 rounded-full shrink-0" onerror="this.style.display='none'">`
              : `<span class="w-6 h-6 shrink-0 inline-block">${SVG_PERSON}</span>`}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-xs font-medium text-slate-800 dark:text-gray-200 truncate">${c.name}</span>
                ${handle ? `<a href="https://github.com/${handle}" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 text-xs shrink-0" onclick="event.stopPropagation()">@${handle}</a>` : ''}
              </div>
              ${aff ? `<div class="text-xs text-slate-400 dark:text-gray-500 truncate">${aff.company}</div>` : ''}
            </div>
            <div class="text-right shrink-0">
              <div class="text-xs text-slate-700 dark:text-gray-300 font-mono">${num(c.contributions)}</div>
              <div class="text-xs text-slate-400 dark:text-gray-500">${pct(c.percentage, 1)}</div>
            </div>
          </div>`;
  }
  const orgTotal = opts.orgTotal ?? 0;
  const wrapperPy = opts.orgModal ? 'py-1' : 'py-0.5';
  const linkOnClick = opts.orgModal ? ' onclick="event.stopPropagation()"' : '';
  const avatarOnerror = opts.orgModal ? ' onerror="this.style.display=\'none\'"' : '';
  return `
        <div class="flex items-center gap-2 ${wrapperPy}">
          <span class="text-slate-300 dark:text-gray-600 text-xs w-5 text-right shrink-0">${i + 1}</span>
          ${c.avatar ? `<img src="${c.avatar}" class="w-5 h-5 rounded-full shrink-0"${avatarOnerror}>` : personPlaceholder('w-5 h-5')}
          <span class="text-xs flex-1 truncate">${c.name}</span>
          ${handle ? `<a href="https://github.com/${handle}" target="_blank" class="text-blue-600 dark:text-blue-500 text-xs shrink-0 hover:text-blue-700 dark:text-blue-300"${linkOnClick}>@${handle}</a>` : ''}
          <span class="text-xs text-slate-400 dark:text-gray-500 font-mono shrink-0">${num(c.contributions)}</span>
          ${opts.orgModal ? `<span class="text-xs text-slate-300 dark:text-gray-600 shrink-0">${orgTotal > 0 ? pct(c.contributions / orgTotal * 100) : ''}</span>` : ''}
        </div>`;
}

// opts: { sigStyle }
// sigStyle: use wider logo, hover wrapper, SVG_BUILDING, and show o.percentage
export function renderOrgRow(o, i, opts = {}) {
  const logo = resolveOrgLogo(o);
  if (opts.sigStyle) {
    return `
          <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-200/50 dark:hover:bg-gray-800/40 transition-colors">
            <span class="text-slate-300 dark:text-gray-600 text-xs w-5 shrink-0 text-right">${i + 1}</span>
            ${logo
              ? `<img src="${logo}" class="w-6 h-6 rounded object-contain shrink-0" onerror="this.style.display='none'">`
              : `<span class="w-6 h-6 shrink-0 inline-block">${SVG_BUILDING}</span>`}
            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium text-slate-800 dark:text-gray-200 truncate">${o.name}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xs text-slate-700 dark:text-gray-300 font-mono">${num(o.contributions)}</div>
              <div class="text-xs text-slate-400 dark:text-gray-500">${pct(o.percentage, 1)}</div>
            </div>
          </div>`;
  }
  return `
      <div class="flex items-center gap-2 py-0.5">
        <span class="text-slate-300 dark:text-gray-600 text-xs w-5 text-right shrink-0">${i + 1}</span>
        ${logo ? `<img src="${logo}" class="w-5 h-5 rounded shrink-0" onerror="this.style.display='none'">` : orgPlaceholder('w-5 h-5')}
        <span class="text-xs flex-1 truncate">${o.name}</span>
        <span class="text-xs text-slate-400 dark:text-gray-500 font-mono shrink-0">${num(o.contributions)}</span>
      </div>`;
}

// Renders the company cell for a contributor row.
// For split contributors (attributedContributions.length > 1), stacks each company
// with a compact date label showing when the company change occurred.
export function companyCell(c, affiliation, gitdmUrl) {
  if (!affiliation) return '<span class="text-slate-300 dark:text-gray-600">—</span>';

  const badgeHref = affiliation.source === 'gitdm'
    ? gitdmUrl
    : `https://github.com/${(c.githubHandleArray || [])[0]}`;
  const badge = `<a href="${badgeHref}" target="_blank" onclick="event.stopPropagation()" class="inline-block px-1 py-0.5 rounded text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-700 hover:border-gray-500 text-[10px] leading-none transition-colors ml-1">${affiliation.source}</a>`;

  const attrs = c.attributedContributions;
  if (attrs?.length > 1) {
    return attrs.map((a, idx) => {
      const isLast  = idx === attrs.length - 1;
      // Only show the split-point date, not the clamped window boundary:
      // first entry → "–until", last entry → "from–", middle → "from–until"
      const dateSpan = s => `<span class="text-slate-400 dark:text-gray-500 text-[10px]">${s}</span>`;
      const range = idx === 0       ? dateSpan(` –${shortYearMonth(a.until)}`)
                  : isLast          ? dateSpan(` ${shortYearMonth(a.from)}–`)
                  : dateSpan(` ${shortYearMonth(a.from)}–${shortYearMonth(a.until)}`);
      return `<div class="leading-snug">${a.company}${range}${isLast ? badge : ''}</div>`;
    }).join('');
  }

  return `${affiliation.company}${badge}`;
}
