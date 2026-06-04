import { S } from '../state.js';
import { el, num, pct, changeBadge, show, hide, destroyChart } from '../utils.js';
import { C } from '../theme.js';
import { usingCache, cacheData } from '../cache.js';
import { liveApi } from '../api.js';
import { orgPlaceholder } from '../render.js';
import { resolveOrgLogo } from '../companies.js';
import { renderChoropleth } from '../geo.js';
import { showError } from '../error.js';

export async function loadOverview() {
  try {
    const cached = usingCache();
    const data   = cached ? cacheData() : null;
    let contrib, orgs, conc, geo;

    if (cached) {
      contrib = data.activeContributors;
      orgs    = data.activeOrganizations;
      conc    = data.contributorDependency;
      geo     = data.geographicalDistribution;
    } else {
      [contrib, orgs, conc, geo] = await Promise.all([
        liveApi('contributors/active-contributors'),
        liveApi('contributors/active-organizations'),
        liveApi('contributors/contributor-dependency'),
        liveApi('contributors/geographical-distribution'),
      ]);
    }

    // Stat cards
    el('stat-contributors').textContent      = num(contrib.summary.current);
    el('stat-contributors-change').innerHTML = changeBadge(contrib.summary.percentageChange);
    el('stat-maintainers').textContent       = num(contrib.maintainerCount);
    el('stat-reviewers').textContent         = num(contrib.reviewerCount);
    el('stat-orgs').textContent              = num(orgs.summary.current);
    el('stat-orgs-change').innerHTML         = changeBadge(orgs.summary.percentageChange);

    // Concentration doughnut
    const topPct   = conc.topContributors.percentage;
    const otherPct = conc.otherContributors.percentage;
    hide('ov-conc-loading'); show('ov-conc-wrap');
    destroyChart('ovConcChart');
    S.charts.ovConcChart = new Chart(el('ovConcChart'), {
      type: 'doughnut',
      data: {
        labels: [
          `Top ${conc.topContributors.count} (${pct(topPct)})`,
          `Other ${num(conc.otherContributors.count)} (${pct(otherPct)})`,
        ],
        datasets: [{ data: [topPct, otherPct], backgroundColor: ['#3b82f6', C.grid()], borderWidth: 0 }],
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { color: C.legend(), font: { size: 11 }, padding: 12, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => ` ${(+c.parsed).toFixed(1)}%` } },
        },
      },
    });
    el('ov-conc-summary').textContent =
      `${conc.topContributors.count} contributors account for ${pct(topPct)} of all activity ` +
      `while ${num(conc.otherContributors.count)} others share the remaining ${pct(otherPct)}.`;

    // Top orgs list
    let topOrgs;
    if (cached) {
      topOrgs = { data: data.organizations.data.slice(0, 15) };
    } else {
      topOrgs = await liveApi('contributors/organization-leaderboard', { offset: 0, limit: 15 });
    }
    const maxC = topOrgs.data[0]?.contributions || 1;
    hide('ov-orgs-loading'); show('ov-orgs-list');
    el('ov-orgs-list').innerHTML = topOrgs.data.map((o, i) => `
      <div class="flex items-center gap-2">
        <span class="text-slate-300 dark:text-gray-600 text-xs w-4 shrink-0">${i + 1}</span>
        ${resolveOrgLogo(o) ? `<img src="${resolveOrgLogo(o)}" class="w-5 h-5 rounded object-contain shrink-0" onerror="this.style.display='none'">` : orgPlaceholder('w-5 h-5')}
        <span class="text-sm flex-1 truncate">${o.name}</span>
        <span class="text-xs text-slate-500 dark:text-gray-400 font-mono shrink-0">${num(o.contributions)}</span>
      </div>`).join('') +
      `<div class="pt-1 text-right">
        <button onclick="setTab('organizations')" class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 transition-colors">more →</button>
      </div>`;

    // Geo world map
    hide('ov-geo-loading'); show('ov-geo-wrap');
    await renderChoropleth('ovGeoChart', 'ovGeoChart', geo.data || []);

  } catch (e) {
    showError(e.message);
    console.error('[overview]', e);
  }
}
