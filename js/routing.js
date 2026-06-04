export const VALID_TABS = ['overview', 'contributors', 'organizations', 'concentration', 'geography', 'sigs'];

export function setHash(tab, detail) {
  if (!detail) {
    history.replaceState(null, '', `#${tab}`);
  } else if (detail.startsWith('page/')) {
    // page numbers are URL-safe — don't encode the slash
    history.replaceState(null, '', `#${tab}/${detail}`);
  } else {
    history.replaceState(null, '', `#${tab}/${encodeURIComponent(detail)}`);
  }
}

// Returns 'page/N' (1-indexed) for the given 0-indexed page, or null for page 0.
export function pageDetail(pageIndex) {
  return pageIndex > 0 ? `page/${pageIndex + 1}` : null;
}

export function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw) return {};
  const slash = raw.indexOf('/');
  if (slash === -1) return { tab: decodeURIComponent(raw) };
  return {
    tab:    decodeURIComponent(raw.slice(0, slash)),
    detail: decodeURIComponent(raw.slice(slash + 1)),
  };
}

export function applyPageDetail(tab, detail, S) {
  if (!detail?.startsWith('page/')) return false;
  const n = parseInt(detail.slice(5), 10);
  if (isNaN(n) || n < 1) return false;
  if (tab === 'contributors')  S.pages.contributors  = n - 1;
  if (tab === 'organizations') S.pages.organizations = n - 1;
  return true;
}
