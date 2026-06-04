import { CACHE } from './state.js';

// ── Company name normalizer (shared by logo lookup + org matching) ──
export const normCompany = s =>
  s.toLowerCase()
   .replace(/[.,\-–]/g, ' ')
   .replace(/\s+(inc|corp|llc|ltd|gmbh|co|dba)\.?\b/g, '')
   .replace(/\s+/g, ' ')
   .trim();

// ── Acronym / alias map — keys and values are normCompany'd strings ──
// Both directions must be present so matching works regardless of which side is the affiliation.
// Maps normalized alternate spellings → canonical normalized name.
// All variants in a group must resolve to the same canonical so that
// resolveAlias(a) === resolveAlias(b) is true for any two spellings.
// The canonical should match (or resolve to) the normCompany of the leaderboard org name.
export const COMPANY_ALIASES = {
  'cncf':                              'cloud native computing foundation',
  'mit':                               'massachusetts institute of technology',
  'm i t':                             'massachusetts institute of technology',
  // "Elasticsearch Inc." affiliations should match the "Elastic" leaderboard org
  'elasticsearch':                     'elastic',
};

export function resolveAlias(normalized) {
  return COMPANY_ALIASES[normalized] ?? normalized;
}

// True when needle (>= 4 chars) appears as whole words inside haystack.
// The length guard prevents short abbreviations like "ibm" or "ing" from
// matching as standalone words inside unrelated longer names.
// e.g. wordMatch("raintank grafana labs", "grafana labs") → true
//      wordMatch("turbonomic an ibm company", "ibm")      → false  (< 4 chars)
//      wordMatch("cloud native computing foundation","ing")→ false  (mid-word)
export function wordMatch(haystack, needle) {
  if (!needle || needle.length < 4) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)').test(haystack);
}

export function orgMatchesSearch(orgName, q) {
  if (!orgName) return false;
  if (orgName.toLowerCase().includes(q)) return true;
  const qn = normCompany(q);
  const on = normCompany(orgName);
  return resolveAlias(qn) === resolveAlias(on);
}

// ── Static logo overrides for orgs not covered by LF Insights ─────
// Keys are normalized (normCompany). Fuzzy-matched, so short keys are fine.
// Logos served by Clearbit; onerror handlers on all <img> tags handle 404s.
// To add more: find the company's domain and add clearbit URL here.
export const LOGO_OVERRIDES = {
  'zillow':                        'https://github.com/zillow.png?size=64',
  'embrace mobile':                'https://github.com/embrace-io.png?size=64',
  'ctbc bank':                     'https://github.com/ctbcbank.png?size=64',
  'picpay':                        'https://github.com/PicPay.png?size=64',
  'sap labs':                      'https://github.com/SAP.png?size=64',
  'bankhaus metzler':              'https://github.com/metzler.png?size=64',
  'giatec':                        'https://github.com/giatec.png?size=64',
  'springer':                      'https://github.com/springernature.png?size=64',
  'lidl':                          'https://github.com/lidl.png?size=64',
  '神策数据':                       'https://github.com/sensorsdata.png?size=64',
};

export function overrideLogo(name) {
  if (!name) return null;
  const cn = normCompany(name);
  for (const [key, url] of Object.entries(LOGO_OVERRIDES)) {
    if (cn === key || cn.includes(key) || key.includes(cn)) return url;
  }
  return null;
}

// Returns logo for an org object. LOGO_OVERRIDES takes priority over the
// API-provided logo so manual entries can replace low-quality favicons.
export function resolveOrgLogo(org) {
  return overrideLogo(org.name) || org.logo;
}

// ── Org logo lookup ────────────────────────────────────────────────
let _orgLogoMap = null;
export function orgLogoMap() {
  if (_orgLogoMap) return _orgLogoMap;
  _orgLogoMap = new Map();
  for (const period of Object.values(CACHE?.periods ?? {})) {
    for (const org of (period?.organizations?.data ?? [])) {
      if (org.logo) _orgLogoMap.set(org.name.toLowerCase(), org.logo);
    }
  }
  return _orgLogoMap;
}

export function logoForCompany(companyName) {
  if (!companyName || !CACHE) return null;
  const over = overrideLogo(companyName);
  if (over) return over;
  const m  = orgLogoMap();
  const cn = normCompany(companyName);
  for (const [orgName, logo] of m) {
    const on = normCompany(orgName);
    if (cn === on || wordMatch(on, cn) || wordMatch(cn, on)) return logo;
  }
  return null;
}
