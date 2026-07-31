import { S } from '../state.js';
import { el, num, pct, show, hide, destroyChart } from '../utils.js';
import { C } from '../theme.js';
import { usingCache, cacheData } from '../cache.js';
import { renderPersonRow, renderOrgRow } from '../render.js';
import { showError } from '../error.js';

export async function loadConcentration() {
  if (!usingCache()) {
    hide('concentration-content'); show('concentration-empty');
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'concentration' }));
    return;
  }
  hide('concentration-empty'); show('concentration-content');

  show('bc-loading');  hide('bc-content');
  show('bc-list-loading'); hide('bc-list');
  show('od-loading');  hide('od-content');
  show('od-list-loading'); hide('od-list');

  try {
    const data = cacheData();
    const conc   = data.contributorDependency;
    const orgDep = data.organizationDependency;

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

    const coreList = (data.contributors?.data || []).slice(0, conc.topContributors.count);
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

    const coreOrgList = (data.organizations?.data || []).slice(0, top.count);
    hide('od-list-loading'); show('od-list');
    el('od-list').innerHTML = coreOrgList.map((o, i) => renderOrgRow(o, i, { sigStyle: true })).join('');
    requestAnimationFrame(() => {
      el('od-list-tile').style.maxHeight = el('od-factor-tile').offsetHeight + 'px';
    });

    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'concentration' }));

  } catch (e) {
    showError(e.message);
    hide('bc-loading'); hide('bc-list-loading'); hide('od-loading'); hide('od-list-loading');
  }
}
