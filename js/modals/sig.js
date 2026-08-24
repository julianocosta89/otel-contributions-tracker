import { SIGS_CACHE, S } from '../state.js';
import { el, num, pct, show, hide, computeDependency } from '../utils.js';
import { renderPersonRow, renderOrgRow } from '../render.js';
import { setHash, timeframeHash } from '../routing.js';

export function openSigModal(repoName) {
  const period = SIGS_CACHE?.periods?.[S.preset]?.[repoName];
  if (!period) return;

  const contribs = period.contributors?.data ?? [];
  const orgs     = period.organizations?.data ?? [];

  el('sig-modal-name').textContent = repoName;
  el('sig-modal-name').href = `https://github.com/open-telemetry/${repoName}`;
  el('sig-modal-contributors').textContent  = num(period.contributors?.total ?? 0);
  el('sig-modal-organizations').textContent = num(period.organizations?.total ?? 0);
  el('sig-modal-period').textContent = `${S.filters.startDate} → ${S.filters.endDate}`;

  // Dependency tiles — computed locally from the per-repo leaderboard data
  const contribDep = computeDependency(contribs);
  if (contribDep) {
    el('sig-modal-top-contributors').textContent = num(contribDep.topCount);
    el('sig-modal-top-contributors-pct').textContent = `${pct(contribDep.topPercentage)} of contributions · ${num(contribDep.otherCount)} other${contribDep.otherCount === 1 ? '' : 's'}`;
  } else {
    el('sig-modal-top-contributors').textContent = '—';
    el('sig-modal-top-contributors-pct').textContent = '—';
  }

  const orgDep = computeDependency(orgs);
  if (orgDep) {
    el('sig-modal-top-orgs').textContent = num(orgDep.topCount);
    el('sig-modal-top-orgs-pct').textContent = `${pct(orgDep.topPercentage)} of contributions · ${num(orgDep.otherCount)} other${orgDep.otherCount === 1 ? '' : 's'}`;
  } else {
    el('sig-modal-top-orgs').textContent = '—';
    el('sig-modal-top-orgs-pct').textContent = '—';
  }

  el('sig-modal-contrib-list').innerHTML = contribs.length
    ? contribs.map((c, i) => renderPersonRow(c, i, { sigStyle: true })).join('')
    : '<p class="text-xs text-slate-500 dark:text-gray-400 text-center py-4">No contributors in this period</p>';

  el('sig-modal-orgs-list').innerHTML = orgs.length
    ? orgs.map((o, i) => renderOrgRow(o, i, { sigStyle: true })).join('')
    : '<p class="text-xs text-slate-500 dark:text-gray-400 text-center py-4">No organizations in this period</p>';

  const modal = el('sig-modal');
  const panel = el('sig-modal-panel');
  panel.scrollTop = 0;
  modal.classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));
  document.body.style.overflow = 'hidden';
  setHash('sigs', timeframeHash(S), repoName);
}

export function closeSigModal() {
  const panel = el('sig-modal-panel');
  if (el('sig-modal').classList.contains('hidden')) return; // no-op if not the currently open modal (e.g. Escape closing another one)
  panel.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => el('sig-modal').classList.add('hidden'), 200);
  setHash('sigs', timeframeHash(S));
}
