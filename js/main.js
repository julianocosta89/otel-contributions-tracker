'use strict';

import { S } from './state.js';
import { initTheme, toggleTheme } from './theme.js';
import { loadCache } from './cache.js';
import { loadAffiliations } from './affiliations.js';
import { VALID_TABS, parseHash, applyPageDetail, setHash } from './routing.js';
import { setTab, reload, loadTab, changePage, setPreset, onDateChange, onFilterChange, hideError, applyTimeframeFromHash } from './ui.js';
import { openContribModal, closeContribModal } from './modals/contributor.js';
import { openOrgModal, closeOrgModal } from './modals/org.js';
import { openSigModal, closeSigModal } from './modals/sig.js';
import { onContribSearch, clearContribSearch } from './tabs/contributors.js';
import { onOrgSearch, clearOrgSearch } from './tabs/organizations.js';
import { onSigsSearch, clearSigsSearch } from './tabs/sigs.js';
import { usingCache, cacheData } from './cache.js';

// ── Deep link: resolve pending modal detail once tab data has loaded ──
let PENDING_DETAIL = null;

function resolvePendingDetail(tab) {
  if (!PENDING_DETAIL || PENDING_DETAIL.tab !== tab) return;
  const detail = PENDING_DETAIL.detail;
  PENDING_DETAIL = null;
  if (tab === 'sigs') {
    openSigModal(detail);
  } else if (tab === 'organizations') {
    const data = usingCache() ? cacheData()?.organizations?.data : S.orgs.filtered;
    const org = (data || []).find(o => o.name?.toLowerCase() === detail.toLowerCase());
    if (org) openOrgModal(org);
  } else if (tab === 'contributors') {
    const data = usingCache() ? cacheData()?.contributors?.data : S.contrib.filtered;
    const c = (data || []).find(c =>
      (c.githubHandleArray || []).some(h => h.toLowerCase() === detail.toLowerCase())
    );
    if (c) openContribModal(c);
  }
}

document.addEventListener('tabLoaded', e => resolvePendingDetail(e.detail));

// ── Delegated click handlers ──────────────────────────────────────
document.addEventListener('click', e => {
  const row = e.target.closest('tr.contrib-row');
  if (!row) return;
  const idx  = parseInt(row.dataset.idx, 10);
  const rows = document.getElementById('contrib-tbody')._rows;
  if (rows && rows[idx]) openContribModal(rows[idx]);
});

document.addEventListener('click', e => {
  const row = e.target.closest('tr.org-row');
  if (!row) return;
  const idx  = parseInt(row.dataset.idx, 10);
  const rows = document.getElementById('orgs-tbody')._rows;
  if (rows && rows[idx]) openOrgModal(rows[idx]);
});

document.addEventListener('click', e => {
  const row = e.target.closest('tr.sig-row');
  if (!row) return;
  openSigModal(row.dataset.repo);
});

// ── Keyboard shortcuts ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeOrgModal(); closeContribModal(); closeSigModal(); }
});

// ── Hash-based routing ─────────────────────────────────────────────
async function navigateToHash() {
  const { tab, timeframe, detail } = parseHash();
  if (!VALID_TABS.includes(tab)) return;
  applyTimeframeFromHash(timeframe, tab);
  if (applyPageDetail(tab, detail, S)) {
    // Page navigation: if already on this tab just reload, otherwise switch
    if (tab === S.tab) loadTab(tab);
    else setTab(tab, { updateHash: false });
  } else {
    if (detail) PENDING_DETAIL = { tab, detail };
    setTab(tab, { updateHash: false });
  }
}

window.addEventListener('hashchange', () => navigateToHash());

// ── Role badge tooltips — fixed positioning escapes overflow-x:auto containers ──
let _tooltipTimer, _activeTooltip = null;

function hideActiveTooltip() {
  if (_activeTooltip) { _activeTooltip.classList.remove('visible'); _activeTooltip = null; }
}

document.addEventListener('mouseover', e => {
  const wrap = e.target.closest('.role-badge-wrap');
  const tooltip = wrap?.querySelector('.role-tooltip');
  clearTimeout(_tooltipTimer);
  if (_activeTooltip && _activeTooltip !== tooltip) hideActiveTooltip();
  if (!tooltip) return;
  const rect = wrap.getBoundingClientRect();
  const inner = tooltip.querySelector('.role-tooltip-inner');
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top  = (rect.top - inner.offsetHeight - 4) + 'px';
  tooltip.classList.add('visible');
  _activeTooltip = tooltip;
});
document.addEventListener('mouseout', e => {
  const wrap = e.target.closest('.role-badge-wrap');
  const tooltip = wrap?.querySelector('.role-tooltip');
  if (!tooltip) return;
  if (e.relatedTarget && wrap.contains(e.relatedTarget)) return;
  clearTimeout(_tooltipTimer);
  _tooltipTimer = setTimeout(hideActiveTooltip, 50);
});

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  initTheme();
  await Promise.all([loadCache(), loadAffiliations()]);

  const { tab, timeframe, detail } = parseHash();
  if (VALID_TABS.includes(tab)) {
    if (!applyPageDetail(tab, detail, S) && detail) PENDING_DETAIL = { tab, detail };
    applyTimeframeFromHash(timeframe, tab); // resets pages to 0 — restore page after this
    applyPageDetail(tab, detail, S);   // re-apply after applyTimeframeFromHash's reload() reset it
    setTab(tab, { updateHash: false });
  } else {
    applyTimeframeFromHash(timeframe);
  }
}

init();

// ── Expose functions needed by inline HTML event handlers ─────────
Object.assign(window, {
  setPreset, onDateChange, onFilterChange, toggleTheme, setTab,
  onContribSearch, clearContribSearch, changePage,
  onOrgSearch, clearOrgSearch, onSigsSearch, clearSigsSearch,
  closeOrgModal, closeContribModal, closeSigModal, hideError,
});
