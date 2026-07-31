import { el, num, show, hide } from '../utils.js';
import { usingCache, cacheData } from '../cache.js';
import { renderChoropleth } from '../geo.js';
import { showError } from '../error.js';
import { toggleSort, sortRows, updateSortIndicators } from '../sort.js';

// Fetched once per tab load, then re-sorted/re-rendered locally on header clicks —
// the choropleth doesn't need re-rendering on sort since it looks countries up by
// code, not array order.
let _geoAll = [];

export async function loadGeography() {
  if (!usingCache()) {
    hide('geo-content'); show('geo-empty');
    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'geography' }));
    return;
  }
  hide('geo-empty'); show('geo-content');
  show('geo-chart-loading'); hide('geo-chart-wrap');
  show('geo-table-loading'); hide('geo-table-wrap');

  try {
    const geo = cacheData().geographicalDistribution;
    _geoAll = geo.data || [];

    el('geo-country-count').textContent = `${_geoAll.length} regions reported`;

    hide('geo-chart-loading'); show('geo-chart-wrap');
    await renderChoropleth('geoChart', 'geoChart', _geoAll);

    renderGeoTable();

    document.dispatchEvent(new CustomEvent('tabLoaded', { detail: 'geography' }));

  } catch (e) {
    showError(e.message);
    hide('geo-chart-loading'); hide('geo-table-loading');
  }
}

function geoAccessor(c, key) {
  switch (key) {
    case 'name':  return c.name || '';
    case 'count': return c.count || 0;
    default:      return 0;
  }
}

function renderGeoTable() {
  const rows = sortRows(_geoAll, 'geography', geoAccessor);
  el('geo-tbody').innerHTML = rows.map(c => `
      <tr class="border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors">
        <td class="px-4 py-2.5 text-sm"><span class="mr-1.5">${c.flag || ''}</span>${c.name}</td>
        <td class="px-4 py-2.5 text-right text-sm font-mono">${num(c.count)}</td>
        <td class="px-4 py-2.5 text-right">
          <span class="text-xs text-slate-500 dark:text-gray-400">${c.percentage}%</span>
        </td>
      </tr>`).join('');
  hide('geo-table-loading'); show('geo-table-wrap');
  updateSortIndicators('#geo-table-wrap', 'geography');
}

export function onGeoSort(key) {
  toggleSort('geography', key);
  renderGeoTable();
}
