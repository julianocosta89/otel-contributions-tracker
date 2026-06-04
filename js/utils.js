import { S } from './state.js';

export const fmtDate = d  => d.toISOString().split('T')[0];
export const today   = () => fmtDate(new Date());
export const daysAgo = n  => { const d = new Date(); d.setDate(d.getDate() - n); return fmtDate(d); };
export const num     = n  => (n == null ? '—' : Number(n).toLocaleString());
export const pct     = (n, dec = 1) => (n == null ? '—' : (+n).toFixed(dec) + '%');
export const shortYearMonth = iso => {
  const [y, m] = iso.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] + " '" + y.slice(2);
};
export const show    = id => document.getElementById(id).classList.remove('hidden');
export const hide    = id => document.getElementById(id).classList.add('hidden');
export const el      = id => document.getElementById(id);

export const changeBadge = p => {
  if (p == null) return '';
  const sign = p > 0 ? '+' : '';
  const cls  = p > 0 ? 'text-green-600 dark:text-green-400' : p < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-gray-400';
  return `<span class="${cls}">${sign}${(+p).toFixed(1)}%</span> <span class="text-slate-300 dark:text-gray-600">vs prior period</span>`;
};

export function deltaCell(current, previous) {
  if (previous == null) return '<td class="px-4 py-2.5"></td>';
  if (previous === 0)   return '<td class="px-4 py-2.5 text-right"><span class="text-xs font-mono text-blue-600 dark:text-blue-400">new</span></td>';
  const change = (current - previous) / previous * 100;
  const sign   = change > 0 ? '+' : '';
  const cls    = change > 0 ? 'text-green-600 dark:text-green-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-gray-500';
  const val    = Math.abs(change) < 1
    ? `${sign}${change.toFixed(1)}%`
    : `${sign}${Math.round(change)}%`;
  return `<td class="px-4 py-2.5 text-right"><span class="text-xs font-mono ${cls}">${val}</span></td>`;
}

export function destroyChart(id) {
  if (S.charts[id]) { S.charts[id].destroy(); delete S.charts[id]; }
}
