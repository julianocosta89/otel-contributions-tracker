import { el, num, show, hide } from '../utils.js';
import { usingCache, cacheData } from '../cache.js';
import { liveApi } from '../api.js';
import { renderChoropleth } from '../geo.js';
import { showError } from '../error.js';

export async function loadGeography() {
  show('geo-chart-loading'); hide('geo-chart-wrap');
  show('geo-table-loading'); hide('geo-table-wrap');

  try {
    const cached = usingCache();
    const data   = cached ? cacheData() : null;
    const geo  = cached
      ? data.geographicalDistribution
      : await liveApi('contributors/geographical-distribution');

    const all = (geo.data || []).sort((a, b) => b.count - a.count);

    el('geo-country-count').textContent = `${all.length} regions reported`;

    hide('geo-chart-loading'); show('geo-chart-wrap');
    await renderChoropleth('geoChart', 'geoChart', all);

    el('geo-tbody').innerHTML = all.map(c => `
      <tr class="border-b border-slate-200 dark:border-gray-800/40 hover:bg-slate-200/50 dark:hover:bg-gray-800/20 transition-colors">
        <td class="px-4 py-2.5 text-sm"><span class="mr-1.5">${c.flag || ''}</span>${c.name}</td>
        <td class="px-4 py-2.5 text-right text-sm font-mono">${num(c.count)}</td>
        <td class="px-4 py-2.5 text-right">
          <span class="text-xs text-slate-500 dark:text-gray-400">${c.percentage}%</span>
        </td>
      </tr>`).join('');
    hide('geo-table-loading'); show('geo-table-wrap');

  } catch (e) {
    showError(e.message);
    hide('geo-chart-loading'); hide('geo-table-loading');
  }
}
