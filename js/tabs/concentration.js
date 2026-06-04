import { S } from '../state.js';
import { el, num, pct, show, hide, destroyChart } from '../utils.js';
import { C } from '../theme.js';
import { usingCache, cacheData } from '../cache.js';
import { liveApi } from '../api.js';
import { renderPersonRow, renderOrgRow } from '../render.js';
import { showError } from '../error.js';

export async function loadConcentration() {
  show('bc-loading');  hide('bc-content');
  show('bc-list-loading'); hide('bc-list');
  show('od-loading');  hide('od-content');
  show('od-list-loading'); hide('od-list');

  try {
    const cached = usingCache();
    const data   = cached ? cacheData() : null;
    let conc, orgDep;
    if (cached) {
      conc   = data.contributorDependency;
      orgDep = data.organizationDependency;
    } else {
      [conc, orgDep] = await Promise.all([
        liveApi('contributors/contributor-dependency'),
        liveApi('contributors/organization-dependency'),
      ]);
    }

    // Contributor bus factor
    el('bc-top-n').textContent   = conc.topContributors.count;
    el('bc-top-pct').textContent = pct(conc.topContributors.percentage);
    hide('bc-loading'); show('bc-content');

    destroyChart('bcChart');
    S.charts.bcChart = new Chart(el('bcChart'), {
      type: 'doughnut',
      data: {
        labels: [
          `Top ${conc.topContributors.count} (${pct(conc.topContributors.percentage)})`,
          `Other ${num(conc.otherContributors.count)} (${pct(conc.otherContributors.percentage)})`,
        ],
        datasets: [{
          data: [conc.topContributors.percentage, conc.otherContributors.percentage],
          backgroundColor: ['#3b82f6', C.grid()], borderColor: ['#2563eb', C.grid()], borderWidth: 1,
        }],
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { color: C.legend(), font: { size: 11 }, padding: 12, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => ` ${(+c.parsed).toFixed(1)}%` } },
        },
      },
    });

    let coreList;
    if (cached) {
      coreList = (data.contributors?.data || []).slice(0, conc.topContributors.count);
    } else {
      const lb = await liveApi('contributors/contributor-leaderboard', { offset: 0, limit: conc.topContributors.count });
      coreList = lb.data || conc.list || [];
    }
    hide('bc-list-loading'); show('bc-list');
    el('bc-list').innerHTML = coreList.map((c, i) => renderPersonRow(c, i, { sigStyle: true })).join('');
    requestAnimationFrame(() => {
      el('bc-list-tile').style.maxHeight = el('bc-factor-tile').offsetHeight + 'px';
    });

    // Org dependency
    const top   = orgDep.topOrganizations  || {};
    const other = orgDep.otherOrganizations || {};
    el('od-top-n').textContent   = top.count ?? '—';
    el('od-top-pct').textContent = pct(top.percentage);
    hide('od-loading'); show('od-content');

    destroyChart('odChart');
    S.charts.odChart = new Chart(el('odChart'), {
      type: 'doughnut',
      data: {
        labels: [
          `Top ${top.count ?? '?'} orgs (${pct(top.percentage)})`,
          `Other orgs (${pct(other.percentage)})`,
        ],
        datasets: [{
          data: [top.percentage || 0, other.percentage || 0],
          backgroundColor: ['#8b5cf6', C.grid()], borderColor: ['#7c3aed', C.grid()], borderWidth: 1,
        }],
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { color: C.legend(), font: { size: 11 }, padding: 12, boxWidth: 12 } },
          tooltip: { callbacks: { label: c => ` ${(+c.parsed).toFixed(1)}%` } },
        },
      },
    });

    let coreOrgList;
    if (cached) {
      coreOrgList = (data.organizations?.data || []).slice(0, top.count);
    } else {
      const lb = await liveApi('contributors/organization-leaderboard', { offset: 0, limit: top.count });
      coreOrgList = lb.data || orgDep.list || [];
    }
    hide('od-list-loading'); show('od-list');
    el('od-list').innerHTML = coreOrgList.map((o, i) => renderOrgRow(o, i, { sigStyle: true })).join('');
    requestAnimationFrame(() => {
      el('od-list-tile').style.maxHeight = el('od-factor-tile').offsetHeight + 'px';
    });

  } catch (e) {
    showError(e.message);
    hide('bc-loading'); hide('bc-list-loading'); hide('od-loading'); hide('od-list-loading');
  }
}
