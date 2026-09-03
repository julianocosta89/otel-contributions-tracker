import { S } from '../state.js';
import { el, num, show, hide, activeThreshold, renderStatLinkButton } from '../utils.js';
import { resolveOrgLogo } from '../companies.js';
import { roleFor, ROLE_STYLE } from '../roles.js';
import { loadSigsCache, sigDetailsForHandles, usingCache } from '../cache.js';
import { renderPersonRow, renderActiveDivider } from '../render.js';
import { contributorsForOrg, renderOrgConcentration } from '../attribution.js';
import { setHash, pageDetail, timeframeHash } from '../routing.js';

// Guards the repo-count tile's async tail (below) against a stale write: bumped on every
// call, so a slow-resolving loadSigsCache() from an earlier, superseded call (modal reopened
// for a different org, or reopened for the same one) can tell it's no longer the active one
// and bail instead of overwriting whatever the newer call already rendered.
let _openSeq = 0;

// ——— Role-filtered contributor list ———
// The Maintainers / Approvers stat tiles are buttons: clicking one filters the
// contributor list below to exactly the people behind that tile's count (highest
// role org-wide — someone who is a maintainer somewhere never also shows up under
// Approvers, matching the tile numbers). Filter state is modal-local: it resets on
// every (re)open and never touches the URL hash, so deep links and Back stay stable.
let _ctx = null;        // { org, contribs, threshold } for the currently-open modal
let _roleFilter = null; // null = all contributors; 'maintainer' | 'approver' = filtered

const ROLE_TILE_IDS = { maintainer: 'org-modal-maintainer-tile', approver: 'org-modal-approver-tile' };

function setRoleFilter(role) {
  _roleFilter = role;
  renderOrgContribList();
}

function renderOrgContribList() {
  const { org, contribs, threshold } = _ctx;
  const entries = contribs.map((c, i) => ({ c, i }));
  const shown = _roleFilter
    ? entries.filter(({ c }) => roleFor(c.githubHandleArray) === _roleFilter)
    : entries;

  // Rows keep their original rank (i) — a filtered list makes it obvious the people
  // are spread across the org's contributor ranking, not re-ranked 1..n within the role.
  const rows = shown.map(({ c, i }) =>
    renderPersonRow(c, i, {
      orgModal: true,
      orgTotal: org.contributions,
      activeMode: threshold != null,
      active: threshold != null && c.contributions >= threshold,
      atLimit: threshold != null && c.contributions === threshold,
    })
  );
  // The list is sorted by contributions descending, so contributors at or above the
  // threshold are always a contiguous prefix — the active/occasional divider is placed
  // at the first below-threshold row of the (possibly filtered) list.
  if (threshold != null) {
    const splitIndex = shown.findIndex(({ c }) => c.contributions < threshold);
    if (splitIndex > 0 && splitIndex < shown.length) {
      rows.splice(splitIndex, 0, renderActiveDivider(threshold));
    }
  }
  el('org-modal-contrib-list').innerHTML = rows.length
    ? rows.join('')
    : `<p class="text-xs text-slate-500 dark:text-gray-400 text-center py-4">No ${_roleFilter ?? 'contributor'}s in this period</p>`;
  el('org-modal-contrib-more').classList.add('hidden');

  // Filter chip next to the "Contributors" heading, colored like the matching role badge
  const chip = el('org-modal-role-filter');
  if (_roleFilter) {
    el('org-modal-role-filter-label').textContent = _roleFilter === 'maintainer' ? 'Maintainers' : 'Approvers';
    el('org-modal-role-filter-nums').textContent = `${num(shown.length)} / ${num(contribs.length)}`;
    chip.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors ${ROLE_STYLE[_roleFilter]}`;
    chip.classList.remove('hidden');
    chip.setAttribute('aria-label', `Clear ${_roleFilter} filter and show all contributors`);
  } else {
    chip.classList.add('hidden');
  }

  // Tile pressed states — the active role tile stays outlined to show what's filtered
  for (const role of Object.keys(ROLE_TILE_IDS)) {
    el(ROLE_TILE_IDS[role]).setAttribute('aria-pressed', String(_roleFilter === role));
  }
}

function setupRoleTiles(contribs) {
  for (const role of Object.keys(ROLE_TILE_IDS)) {
    const count = contribs.filter(c => roleFor(c.githubHandleArray) === role).length;
    const tile = el(ROLE_TILE_IDS[role]);
    el(tile.id.replace('-tile', '-count')).textContent = num(count) || '0';
    tile.disabled = count === 0;
    tile.setAttribute('aria-label', count === 0
      ? `No ${role}s in this organization`
      : `Show only ${role}s (${num(count)} of ${num(contribs.length)} contributors)`);
    tile.onclick = () => { if (!tile.disabled) setRoleFilter(_roleFilter === role ? null : role); };
  }
}

export async function openOrgModal(org) {
  const seq = ++_openSeq;
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
  renderOrgConcentration(contribs, org.contributions);

  // Contributors tile: for presets with an active-contributor threshold, show
  // "active / total" and relabel the tile; otherwise show the plain total.
  const threshold = activeThreshold(S.preset);
  if (threshold != null) {
    const activeCount = contribs.filter(c => c.contributions >= threshold).length;
    el('org-modal-contributor-label').textContent = 'Active Contributors';
    el('org-modal-contributor-count').textContent = contribs.length ? `${num(activeCount)} / ${num(contribs.length)}` : '—';
  } else {
    el('org-modal-contributor-label').textContent = 'Contributors';
    el('org-modal-contributor-count').textContent = contribs.length || '—';
  }

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

  // Maintainer / approver tiles (counts + click-to-filter behaviour)
  setupRoleTiles(contribs);

  // Repo count tile resets here; filled in (as a link into Coverage, or a plain dash) below
  // once contribs are known. The tile's own markup is always fully replaced (spinner / dash
  // text / button), so there's no interactive state left on this container to reset.
  const repoCountEl = el('org-modal-repo-count');
  repoCountEl.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:1.5px"></span>';

  // Render the contributor list (scrollable) through the shared role-filter path —
  // a fresh open always starts unfiltered, with the active/occasional divider inserted
  // at the first below-threshold row (list is sorted by contributions descending).
  _ctx = { org, contribs, threshold };
  setRoleFilter(null);
  el('org-modal-role-filter').onclick = () => setRoleFilter(null);

  // Consumed once: only set when this open was reached via the coverage modal's people-count
  // link (coverage.js), so a direct Organizations-tab row click never shows a stale back target.
  const backTo = S.nav.backTo;
  S.nav.backTo = null;
  const backEl = el('org-modal-back');
  if (backTo?.tab === 'coverage' && backTo.name.toLowerCase() === org.name.toLowerCase()) {
    show('org-modal-back');
    backEl.onclick = () => {
      closeOrgModal();
      location.hash = `#coverage/${timeframeHash(S)}/${encodeURIComponent(org.name)}`;
    };
  } else {
    hide('org-modal-back');
    backEl.onclick = null;
  }

  // Show modal + animate
  el('org-modal').classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));
  document.body.style.overflow = 'hidden';
  setHash('organizations', timeframeHash(S), org.name);

  if (contribs.length === 0) {
    repoCountEl.textContent = '—';
    return;
  }

  // Repo count links out to Coverage's per-SIG breakdown for this org — only when Coverage
  // itself can render (cache-backed data + "All platforms"). Custom date ranges / other
  // platform filters have no repo-level data source, so the tile stays a plain dash.
  if (S.filters.platform !== 'all' || !usingCache()) {
    repoCountEl.textContent = '—';
    return;
  }

  await loadSigsCache();

  // The await above can outlive this call's relevance: the modal may have been closed and
  // reopened (for this org or another) while data/sigs.json was loading, or the platform
  // filter may have changed underneath this still-open modal (the filter control itself is
  // unreachable while a modal's backdrop is up, but closing this modal first and changing
  // it while the fetch is still in flight is not). Re-checking both keeps a superseded or
  // now-stale continuation from clobbering the tile with a mismatched-scope repo link.
  if (seq !== _openSeq) return;
  if (S.filters.platform !== 'all' || !usingCache()) {
    repoCountEl.textContent = '—';
    return;
  }

  const handles = new Set(contribs.flatMap(c => (c.githubHandleArray || []).map(h => h.toLowerCase())));
  const repos = sigDetailsForHandles(handles);
  if (repos === null) {
    repoCountEl.textContent = '—';
    return;
  }
  // Navigating via the hash (rather than calling openCoverageModal() directly) routes through
  // main.js's setTab()/PENDING_DETAIL machinery, so the underlying tab actually switches to
  // Coverage instead of leaving the Organizations tab rendered behind a Coverage-hash URL.
  repoCountEl.replaceChildren(renderStatLinkButton({
    count: num(repos.length) || '0',
    ariaLabel: `View repository breakdown for ${org.name} in Coverage`,
    onClick: () => {
      S.nav.backTo = { tab: 'organizations', name: org.name };
      closeOrgModal();
      location.hash = `#coverage/${timeframeHash(S)}/${encodeURIComponent(org.name)}`;
    },
  }));
}

export function closeOrgModal() {
  const panel = el('org-modal-panel');
  if (el('org-modal').classList.contains('hidden')) return; // no-op if not the currently open modal (e.g. Escape closing another one)
  panel.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => el('org-modal').classList.add('hidden'), 200);
  setHash('organizations', timeframeHash(S), pageDetail(S.pages.organizations));
}
