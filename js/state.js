export let CACHE             = null;  // loaded from data/cache.json
export let AFFILIATIONS      = {};    // loaded from data/affiliations.json (handle -> { company, ranges, file, lineStart, lineEnd })
export let GH_COMPANIES      = {};    // loaded from data/github-companies.json (handle -> company, source: github)
export let ROLES             = {};    // loaded from data/roles.json (handle -> highest role)
export let SIGS_CACHE        = null;  // null = not yet fetched, false = unavailable, object = loaded

export function setCache(v)        { CACHE = v; }
export function setAffiliations(v) { AFFILIATIONS = v; }
export function setGhCompanies(v)  { GH_COMPANIES = v; }
export function setRoles(v)        { ROLES = v; }
export function setSigsCache(v)    { SIGS_CACHE = v; }

export let _sigsLoadPromise = null;
export function setSigsLoadPromise(v) { _sigsLoadPromise = v; }

// Natural (server-provided) sort order per tab — the starting point before any
// column-header click reorders a table. sort.js's isDefaultSort() compares against
// this to decide whether search-time "true leaderboard rank" lookups still apply.
export const SORT_DEFAULTS = {
  contributors:  { key: 'contributions', dir: 'desc' },
  organizations: { key: 'contributions', dir: 'desc' },
  coverage:      { key: 'contributions', dir: 'desc' },
  sigs:          { key: 'contributors',  dir: 'desc' },
  geography:     { key: 'count',         dir: 'desc' },
};

export const S = {
  tab:    'overview',
  preset: '1y',
  filters: { startDate: '', endDate: '', platform: 'all' },
  pages:  { contributors: 0, organizations: 0, coverage: 0 },
  charts: {},
  // runtime search/filter state
  contrib:  { filtered: [], total: 0 },
  orgs:     { filtered: [], total: 0 },
  coverage: { filtered: [], total: 0 },
  // per-tab column sort state — see js/sort.js
  sort: Object.fromEntries(Object.entries(SORT_DEFAULTS).map(([k, v]) => [k, { ...v }])),
  // Transient cross-modal navigation intent — set immediately before a hash change that
  // should carry a "come back here" breadcrumb: { tab: the modal's tab the user came from,
  // name: the org name }. Consumed (read once, then cleared) by the destination modal's open
  // function, which shows its own "← back" link only when tab+name both match. See the
  // Repositories/People stat-tile links in org.js/coverage.js.
  nav: { backTo: null },
};
