export const VALID_TABS    = ['overview', 'contributors', 'organizations', 'concentration', 'geography', 'sigs'];
export const VALID_PRESETS = ['30d', '90d', '6m', '1y', '2y', '3y', 'all'];

// Returns true for valid presets, date ranges, AND things that look like
// preset attempts (e.g. "20d", "5y") so they reach the redirect fallback
// instead of being silently misread as entity-detail deep-links.
function isTimeframeSegment(s) {
  return VALID_PRESETS.includes(s)
    || /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(s)
    || /^(\d+[dmy]|all)$/.test(s);
}

// Returns a URL-safe timeframe string from current state S.
export function timeframeHash(S) {
  return S.preset !== 'custom'
    ? S.preset
    : `${S.filters.startDate}..${S.filters.endDate}`;
}

// Hash format: #tab  or  #tab/timeframe  or  #tab/timeframe/detail
// timeframe is a preset key (e.g. "1y") or a date range ("2025-01-01..2026-01-01")
// detail is a page ref ("page/N") or an entity name (URL-encoded)
export function setHash(tab, timeframe, detail) {
  let hash = tab;
  if (timeframe) hash += '/' + timeframe;
  if (detail) {
    if (detail.startsWith('page/')) hash += '/' + detail;
    else hash += '/' + encodeURIComponent(detail);
  }
  history.replaceState(null, '', `#${hash}`);
}

// Returns 'page/N' (1-indexed) for the given 0-indexed page, or null for page 0.
export function pageDetail(pageIndex) {
  return pageIndex > 0 ? `page/${pageIndex + 1}` : null;
}

export function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw) return {};
  const segments = raw.split('/');
  const tab = decodeURIComponent(segments[0]);
  if (segments.length === 1) return { tab };

  // Check if second segment is a timeframe; if not, treat everything after tab as detail (backward compat)
  let timeframe = null;
  let rest;
  if (isTimeframeSegment(segments[1])) {
    timeframe = segments[1];
    rest = segments.slice(2);
  } else {
    rest = segments.slice(1);
  }

  if (rest.length === 0) return { tab, timeframe };

  // page/N uses two segments; entity names are always a single URL-encoded segment
  const detail = (rest.length >= 2 && rest[0] === 'page')
    ? rest.join('/')
    : decodeURIComponent(rest[0]);
  return { tab, timeframe, detail };
}

export function applyPageDetail(tab, detail, S) {
  if (!detail?.startsWith('page/')) return false;
  const n = parseInt(detail.slice(5), 10);
  if (isNaN(n) || n < 1) return false;
  if (tab === 'contributors')  S.pages.contributors  = n - 1;
  if (tab === 'organizations') S.pages.organizations = n - 1;
  return true;
}
