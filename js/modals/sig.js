import { SIGS_CACHE, S } from '../state.js';
import { el, num, show, hide } from '../utils.js';
import { renderPersonRow, renderOrgRow } from '../render.js';
import { setHash } from '../routing.js';

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

  el('sig-modal-contrib-list').innerHTML = contribs.length
    ? contribs.map((c, i) => renderPersonRow(c, i, { sigStyle: true })).join('')
    : '<p class="text-xs text-slate-300 dark:text-gray-600 text-center py-4">No contributors in this period</p>';

  el('sig-modal-orgs-list').innerHTML = orgs.length
    ? orgs.map((o, i) => renderOrgRow(o, i, { sigStyle: true })).join('')
    : '<p class="text-xs text-slate-300 dark:text-gray-600 text-center py-4">No organizations in this period</p>';

  const modal = el('sig-modal');
  const panel = el('sig-modal-panel');
  panel.scrollTop = 0;
  modal.classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));
  document.body.style.overflow = 'hidden';
  setHash('sigs', repoName);
}

export function closeSigModal() {
  const panel = el('sig-modal-panel');
  panel.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => el('sig-modal').classList.add('hidden'), 200);
  setHash('sigs');
}
