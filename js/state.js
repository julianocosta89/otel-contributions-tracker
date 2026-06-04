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

export const S = {
  tab:    'overview',
  preset: '1y',
  filters: { startDate: '', endDate: '', platform: 'all' },
  pages:  { contributors: 0, organizations: 0 },
  charts: {},
  // runtime search/filter state
  contrib: { filtered: [], total: 0 },
  orgs:    { filtered: [], total: 0 },
};
