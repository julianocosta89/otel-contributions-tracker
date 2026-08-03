import { S } from '../state.js';
import { el, num, show, hide, renderStatLinkButton } from '../utils.js';
import { resolveOrgLogo } from '../companies.js';
import { sigDetailsForHandles } from '../cache.js';
import { contributorsForOrg } from '../attribution.js';
import { renderPersonRow } from '../render.js';
import { setHash, pageDetail, timeframeHash } from '../routing.js';

function renderSigEntry(repo) {
  return `
    <details class="group rounded-lg bg-slate-200/50 dark:bg-gray-800/30 overflow-hidden">
      <summary class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none hover:bg-slate-200/80 dark:hover:bg-gray-800/60 transition-colors">
        <svg class="w-3 h-3 text-slate-600 dark:text-gray-400 shrink-0 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9,6 15,12 9,18"/>
        </svg>
        <span class="text-xs font-medium text-slate-700 dark:text-gray-300 flex-1 truncate">${repo.name}</span>
        <span class="text-xs text-slate-600 dark:text-gray-400 font-mono shrink-0">${num(repo.count)} · ${repo.contributors.length} ${repo.contributors.length === 1 ? 'person' : 'people'}</span>
      </summary>
      <div class="px-2 pb-2 space-y-0.5">
        <a href="${repo.url}" target="_blank"
          class="block text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-1 pb-1">${repo.name} on GitHub →</a>
        ${repo.contributors.map((c, i) => renderPersonRow(c, i, { sigStyle: true, showRole: true, repoName: repo.name })).join('')}
      </div>
    </details>`;
}

export function openCoverageModal(org) {
  const panel = el('coverage-modal-panel');

  const orgLogo = resolveOrgLogo(org);
  el('coverage-modal-logo').src           = orgLogo || '';
  el('coverage-modal-logo').style.display = orgLogo ? '' : 'none';
  el('coverage-modal-logo-ph').style.display = orgLogo ? 'none' : '';
  el('coverage-modal-name').textContent = org.name;
  el('coverage-modal-period').textContent = `${S.filters.startDate} → ${S.filters.endDate}`;

  const contribs = contributorsForOrg(org.name);
  const handles  = new Set(contribs.flatMap(c => (c.githubHandleArray || []).map(h => h.toLowerCase())));
  const repos    = sigDetailsForHandles(handles) ?? [];

  el('coverage-modal-sig-count').textContent = repos.length || '0';

  // People count links out to the Organizations modal's full contributor/role breakdown for
  // this org — same tab-switching approach as the Repositories link in org.js (hash-navigate
  // rather than call openOrgModal() directly, so the underlying tab actually switches too).
  // Always available here: reaching this modal at all already implies cache-backed data for
  // "All platforms" (Coverage's own gate — see coverageAvailable() in tabs/coverage.js, which
  // main.js's resolvePendingDetail() also checks before opening this modal from a hash detail).
  el('coverage-modal-people-count').replaceChildren(renderStatLinkButton({
    count: num(contribs.length) || '0',
    ariaLabel: `View organization details for ${org.name}`,
    onClick: () => {
      S.nav.backTo = { tab: 'coverage', name: org.name };
      closeCoverageModal();
      location.hash = `#organizations/${timeframeHash(S)}/${encodeURIComponent(org.name)}`;
    },
  }));

  el('coverage-modal-list').innerHTML = repos.length
    ? repos.map(renderSigEntry).join('')
    : '<p class="text-xs text-slate-500 dark:text-gray-400 text-center py-4">No SIG activity found for this period</p>';

  // Consumed once: only set when this open was reached via the org modal's repo-count
  // link (org.js), so a direct Coverage-tab row click never shows a stale back target.
  const backTo = S.nav.backTo;
  S.nav.backTo = null;
  const backEl = el('coverage-modal-back');
  if (backTo?.tab === 'organizations' && backTo.name.toLowerCase() === org.name.toLowerCase()) {
    show('coverage-modal-back');
    backEl.onclick = () => {
      closeCoverageModal();
      location.hash = `#organizations/${timeframeHash(S)}/${encodeURIComponent(org.name)}`;
    };
  } else {
    hide('coverage-modal-back');
    backEl.onclick = null;
  }

  panel.scrollTop = 0;
  el('coverage-modal').classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));
  document.body.style.overflow = 'hidden';
  setHash('coverage', timeframeHash(S), org.name);
}

export function closeCoverageModal() {
  const panel = el('coverage-modal-panel');
  if (el('coverage-modal').classList.contains('hidden')) return; // no-op if not the currently open modal (e.g. Escape closing another one)
  panel.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => el('coverage-modal').classList.add('hidden'), 200);
  setHash('coverage', timeframeHash(S), pageDetail(S.pages.coverage));
}
