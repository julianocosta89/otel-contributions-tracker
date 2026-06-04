import { CACHE, S } from './state.js';
import { el, num, pct } from './utils.js';
import { normCompany, wordMatch, resolveAlias } from './companies.js';
import { affiliationFor } from './affiliations.js';
import { cacheData } from './cache.js';

export function companyMatchesOrg(companyName, orgName) {
  const cn = normCompany(companyName);
  const on = normCompany(orgName);
  if (cn === on) return true;
  // Whole-word substring match, min 4 chars (e.g. "Grafana Labs" in "Raintank … Grafana Labs")
  if (wordMatch(on, cn) || wordMatch(cn, on)) return true;
  // Space-stripped equality (handles "MercadoLibre" vs "Mercado Libre")
  if (cn.replace(/\s/g, '') === on.replace(/\s/g, '')) return true;
  // Alias comparison (handles acronyms / rebrands, e.g. CNCF, Elasticsearch → Elastic)
  // Resolved transitively so any two spellings in an alias group match each other.
  return resolveAlias(cn) === resolveAlias(on);
}

export function contributorsForOrg(orgName) {
  if (!CACHE) return [];
  return (cacheData().contributors?.data || []).flatMap(c => {
    // Split contributors: attribute only the matching company's contributions
    if (c.attributedContributions?.length) {
      const matching = c.attributedContributions.filter(a => companyMatchesOrg(a.company, orgName));
      if (!matching.length) return [];
      const contributions = matching.reduce((s, a) => s + a.contributions, 0);
      return [{ ...c, contributions }];
    }
    // Single-company contributors: use current affiliation
    const aff = affiliationFor(c.githubHandleArray);
    return (aff && companyMatchesOrg(aff.company, orgName)) ? [c] : [];
  });
}

export function calcOrgConcentration(contribs, orgTotal) {
  if (!contribs.length) return { status: 'limited' };
  const cacheTotal = contribs.reduce((s, c) => s + c.contributions, 0);
  if (orgTotal > 0 && cacheTotal / orgTotal < 0.3) return { status: 'limited' };
  const hhi = contribs.reduce((s, c) => {
    const share = c.contributions / cacheTotal * 100;
    return s + share * share;
  }, 0);
  const top1Pct = orgTotal > 0 ? contribs[0].contributions / orgTotal * 100 : contribs[0].contributions / cacheTotal * 100;
  const label = hhi < 1500 ? 'Distributed' : hhi < 3000 ? 'Moderate' : 'Concentrated';
  const color = hhi < 1500 ? 'green' : hhi < 3000 ? 'yellow' : 'red';
  return { status: 'ok', hhi: Math.round(hhi), top1Pct, label, color };
}

export function renderOrgConcentration(contribs, orgTotal) {
  const r = calcOrgConcentration(contribs, orgTotal);
  const target = el('org-modal-concentration');
  if (r.status === 'limited') {
    target.innerHTML = `<span class="text-xs text-slate-400 dark:text-gray-500 italic">Not enough GitHub data to assess</span>`;
    return;
  }
  const dot   = r.color === 'green' ? 'bg-green-500'  : r.color === 'yellow' ? 'bg-yellow-500'  : 'bg-red-500';
  const label = r.color === 'green' ? 'text-green-600 dark:text-green-400' : r.color === 'yellow' ? 'text-yellow-400' : 'text-red-600 dark:text-red-400';
  target.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full ${dot} shrink-0"></span>
      <span class="text-sm font-semibold ${label}">${r.label}</span>
      <span class="text-xs text-slate-300 dark:text-gray-600 font-mono ml-auto">HHI ${num(r.hhi)}</span>
    </div>
    <div class="text-xs text-slate-400 dark:text-gray-500 mt-1">Top contributor: ${pct(r.top1Pct)} of ${S.filters.platform === 'all' ? 'all-platform' : S.filters.platform} activity</div>`;
}
