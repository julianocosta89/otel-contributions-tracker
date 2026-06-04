import { S } from '../state.js';
import { el, num, pct, show, hide } from '../utils.js';
import { affiliationFor } from '../affiliations.js';
import { roleBadge, roleFor } from '../roles.js';
import { logoForCompany } from '../companies.js';
import { loadSigsCache, reposFromCache } from '../cache.js';
import { fetchContribRepos } from '../api.js';
import { renderReposList } from '../render.js';
import { setHash, pageDetail, timeframeHash } from '../routing.js';

export async function openContribModal(contributor) {
  const modal   = el('contrib-modal');
  const panel   = el('contrib-modal-panel');
  const handles = contributor.githubHandleArray || [];
  const aff     = affiliationFor(handles);

  // Populate header
  el('modal-avatar').src = contributor.avatar || '';
  el('modal-avatar').style.display    = contributor.avatar ? '' : 'none';
  el('modal-avatar-ph').style.display = contributor.avatar ? 'none' : '';
  el('modal-name').textContent = contributor.name;
  el('modal-handles').innerHTML = handles
    .map(h => `<a href="https://github.com/${h}" target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300">@${h}</a>`)
    .join(', ') || '—';

  // Stats
  el('modal-contributions').textContent = num(contributor.contributions);
  el('modal-share').textContent = pct(contributor.percentage, 2);
  const logo = logoForCompany(aff?.company);
  const companyEl = el('modal-company');
  if (logo && aff?.company) {
    companyEl.innerHTML = `<img src="${logo}" alt="${aff.company}" title="${aff.company}"
      class="w-8 h-8 rounded object-contain"
      onerror="this.outerHTML='<span class=\\'text-xs font-medium\\'>${aff.company.replace(/'/g,'&#39;')}</span>'">`;
  } else {
    companyEl.textContent = aff?.company ?? '—';
  }

  // Roles
  const rolesWrap = el('modal-roles-wrap');
  const role = roleFor(contributor.githubHandleArray);
  if (role) {
    rolesWrap.classList.remove('hidden');
    rolesWrap.innerHTML = roleBadge(contributor.githubHandleArray, false);
  } else {
    rolesWrap.classList.add('hidden');
  }

  // Period label
  el('modal-period-label').textContent =
    `${S.filters.startDate} → ${S.filters.endDate}`;

  // Reset repo area
  show('modal-repos-loading');
  hide('modal-repos-list');
  hide('modal-repos-error');
  el('modal-repos-list').innerHTML = '';

  // Show modal + animate panel in
  modal.classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  const primaryHandle = (contributor.githubHandleArray || [])[0] || contributor.name;
  setHash('contributors', timeframeHash(S), primaryHandle);

  // Prefer LFX cache; fall back to GitHub PR search
  await loadSigsCache();
  const cachedRepos = reposFromCache(handles);
  if (cachedRepos !== null) {
    hide('modal-repos-loading');
    const total = cachedRepos.reduce((s, r) => s + r.count, 0);
    const ok = renderReposList({
      repos: cachedRepos, unit: 'contribution', barColor: 'bg-blue-500',
      listElId: 'modal-repos-list',
      note: cachedRepos.length
        ? `${num(total)} contributions across ${cachedRepos.length} repo${cachedRepos.length === 1 ? '' : 's'}`
        : null,
    });
    ok ? show('modal-repos-list') : (show('modal-repos-error'), el('modal-repos-error').textContent = 'No repository activity found for this period.');
  } else if (handles.length) {
    fetchContribRepos(handles, S.filters.startDate, S.filters.endDate)
      .then(result => renderContribRepos(result, handles))
      .catch(err => {
        hide('modal-repos-loading');
        show('modal-repos-error');
        el('modal-repos-error').innerHTML =
          `<p class="mb-2">Could not load repositories.</p>` +
          `<p class="text-slate-300 dark:text-gray-600">${err.message}</p>` +
          (handles[0]
            ? `<a href="https://github.com/search?q=author%3A${handles[0]}+org%3Aopen-telemetry&type=pullrequests" target="_blank"
                class="inline-block mt-3 px-3 py-1.5 rounded bg-slate-200 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 text-xs transition-colors">
                Search on GitHub →</a>`
            : '');
      });
  } else {
    hide('modal-repos-loading');
    show('modal-repos-error');
    el('modal-repos-error').textContent = 'No GitHub handle available.';
  }
}

export function closeContribModal() {
  const panel = el('contrib-modal-panel');
  panel.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => el('contrib-modal').classList.add('hidden'), 200);
  setHash('contributors', timeframeHash(S), pageDetail(S.pages.contributors));
}

export function renderContribRepos(result, handles) {
  hide('modal-repos-loading');

  if (!result.repos.length) {
    show('modal-repos-error');
    el('modal-repos-error').innerHTML =
      `No pull requests found in this period.<br>
       <a href="${result.searchUrl}" target="_blank"
         class="inline-block mt-3 px-3 py-1.5 rounded bg-slate-200 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 text-xs transition-colors">
         Search on GitHub →</a>`;
    return;
  }

  const note = result.truncated
    ? `Showing repos from first 100 of ${num(result.totalPRs)} PRs · <a href="${result.searchUrl}" target="_blank" class="text-blue-600 dark:text-blue-500 hover:text-blue-600 dark:text-blue-400">see all →</a>`
    : `${num(result.totalPRs)} pull request${result.totalPRs === 1 ? '' : 's'} in ${result.repos.length} repo${result.repos.length === 1 ? '' : 's'} · <a href="${result.searchUrl}" target="_blank" class="text-blue-600 dark:text-blue-500 hover:text-blue-600 dark:text-blue-400">view on GitHub →</a>`;

  renderReposList({
    repos: result.repos,
    unit: 'PR',
    listElId: 'modal-repos-list',
    note,
  });
  show('modal-repos-list');
}
