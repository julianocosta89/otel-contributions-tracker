import { S } from '../state.js';
import { el, num, show, hide } from '../utils.js';
import { resolveOrgLogo } from '../companies.js';
import { roleFor } from '../roles.js';
import { loadSigsCache, orgReposFromCache } from '../cache.js';
import { fetchOrgRepos } from '../api.js';
import { renderPersonRow, renderReposList } from '../render.js';
import { contributorsForOrg, renderOrgConcentration } from '../attribution.js';
import { setHash, pageDetail, timeframeHash } from '../routing.js';

export async function openOrgModal(org) {
  const panel = el('org-modal-panel');

  // Header
  const orgLogo = resolveOrgLogo(org);
  el('org-modal-logo').src           = orgLogo || '';
  el('org-modal-logo').style.display = orgLogo ? '' : 'none';
  el('org-modal-logo-ph').style.display = orgLogo ? 'none' : '';
  el('org-modal-name').textContent = org.name;

  // Stats
  el('org-modal-contributions').textContent = num(org.contributions);
  el('org-modal-period-label').textContent   = `${S.filters.startDate} → ${S.filters.endDate}`;

  // Find contributors from cache, sorted by org-attributed contributions
  const contribs = contributorsForOrg(org.name)
    .sort((a, b) => b.contributions - a.contributions);
  el('org-modal-contributor-count').textContent = contribs.length || '—';
  renderOrgConcentration(contribs, org.contributions);

  // Attribution note: surface discrepancy between LFX org total and gitdm-attributed total
  // when any contributor in the list was split across employers within the query window.
  const hasSplitContrib = contribs.some(c => c.attributedContributions?.length > 1);
  const noteEl = el('org-modal-attribution-note');
  if (hasSplitContrib) {
    const gitdmTotal = contribs.reduce((s, c) => s + c.contributions, 0);
    el('org-modal-lfx-total').textContent       = num(org.contributions);
    el('org-modal-attributed-total').textContent = num(gitdmTotal);
    noteEl.classList.remove('hidden');
  } else {
    noteEl.classList.add('hidden');
  }

  // Maintainer / approver counts
  el('org-modal-maintainer-count').textContent = contribs.filter(c => roleFor(c.githubHandleArray) === 'maintainer').length || '0';
  el('org-modal-approver-count').textContent   = contribs.filter(c => roleFor(c.githubHandleArray) === 'approver').length || '0';

  // Repo count spinner
  el('org-modal-repo-count').innerHTML =
    '<span id="org-repo-count-spinner" class="spinner" style="width:14px;height:14px;border-width:1.5px"></span>';

  // Render full contributor list (scrollable)
  el('org-modal-contrib-list').innerHTML = contribs.map((c, i) =>
    renderPersonRow(c, i, { orgModal: true, orgTotal: org.contributions })
  ).join('');

  el('org-modal-contrib-more').classList.add('hidden');

  // Reset repos area
  show('org-modal-repos-loading');
  hide('org-modal-repos-list');
  hide('org-modal-repos-error');
  el('org-modal-repos-list').innerHTML = '';

  // Show modal + animate
  el('org-modal').classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));
  document.body.style.overflow = 'hidden';
  setHash('organizations', timeframeHash(S), org.name);

  if (contribs.length === 0) {
    hide('org-modal-repos-loading');
    show('org-modal-repos-error');
    el('org-modal-repos-error').textContent = 'No contributors found in cache for this period.';
    el('org-modal-repo-count').textContent = '—';
    return;
  }

  // Prefer LFX cache (all contributors); fall back to GitHub API (top 8)
  await loadSigsCache();
  const cachedOrgRepos = orgReposFromCache(contribs);
  if (cachedOrgRepos !== null) {
    hide('org-modal-repos-loading');
    el('org-modal-repo-count').textContent = cachedOrgRepos.length || '—';
    const total = cachedOrgRepos.reduce((s, r) => s + r.count, 0);
    const ok = renderReposList({
      repos: cachedOrgRepos, unit: 'contribution', barColor: 'bg-purple-500',
      listElId: 'org-modal-repos-list',
      note: cachedOrgRepos.length
        ? `${num(total)} contributions across ${cachedOrgRepos.length} repo${cachedOrgRepos.length === 1 ? '' : 's'}`
        : null,
    });
    ok ? show('org-modal-repos-list') : (show('org-modal-repos-error'), el('org-modal-repos-error').textContent = 'No repository activity found for this period.');
  } else {
    // Fall back to GitHub API using top 8 contributors
    const TOP_N     = 8;
    const topContribs = contribs.slice(0, TOP_N);
    fetchOrgRepos(topContribs, org, S.filters.startDate, S.filters.endDate)
      .then(({ repos, truncated, totalPRs }) => renderOrgRepos(repos, truncated, totalPRs, org, topContribs.length < contribs.length))
      .catch(err => {
        hide('org-modal-repos-loading');
        show('org-modal-repos-error');
        el('org-modal-repos-error').innerHTML =
          `<p class="mb-2">Could not load repositories.</p><p class="text-slate-300 dark:text-gray-600">${err.message}</p>`;
        el('org-modal-repo-count').textContent = '—';
      });
  }
}

function renderOrgRepos(repos, truncated, totalPRs, org, isPartial) {
  hide('org-modal-repos-loading');

  // Update repo count in stats
  el('org-modal-repo-count').textContent = repos.length || '—';

  const note = `${num(totalPRs)} PRs across ${repos.length} repo${repos.length === 1 ? '' : 's'}${isPartial ? ` · <span class="italic">Based on top ${Math.min(8, repos.length)} contributors</span>` : ''}`;
  const ok = renderReposList({
    repos,
    unit: 'PR',
    listElId: 'org-modal-repos-list',
    note,
  });
  if (!ok) {
    show('org-modal-repos-error');
    el('org-modal-repos-error').textContent = 'No pull requests found in this period.';
    return;
  }
  show('org-modal-repos-list');
}

export function closeOrgModal() {
  el('org-modal-panel').classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => el('org-modal').classList.add('hidden'), 200);
  setHash('organizations', timeframeHash(S), pageDetail(S.pages.organizations));
}
