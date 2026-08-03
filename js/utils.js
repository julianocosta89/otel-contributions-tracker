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
  const cls  = p > 0 ? 'text-green-700 dark:text-green-400' : p < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-gray-400';
  return `<span class="${cls}">${sign}${(+p).toFixed(1)}%</span> <span class="text-slate-500 dark:text-gray-400">vs prior period</span>`;
};

export function deltaCell(current, previous) {
  if (previous == null) return '<td class="px-4 py-2.5"></td>';
  if (previous === 0)   return '<td class="px-4 py-2.5 text-right"><span class="text-xs font-mono text-blue-600 dark:text-blue-400">new</span></td>';
  const change = (current - previous) / previous * 100;
  const sign   = change > 0 ? '+' : '';
  const cls    = change > 0 ? 'text-green-700 dark:text-green-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-gray-400';
  const val    = Math.abs(change) < 1
    ? `${sign}${change.toFixed(1)}%`
    : `${sign}${Math.round(change)}%`;
  return `<td class="px-4 py-2.5 text-right"><span class="text-xs font-mono ${cls}">${val}</span></td>`;
}

export function destroyChart(id) {
  if (S.charts[id]) { S.charts[id].destroy(); delete S.charts[id]; }
}

// Active-contributor threshold: >=2 contributions/month, scaled to the preset's span.
// Only defined for timeframes up to 1y — beyond that, sustaining 2/mo for years is rare
// enough that the split stops being a meaningful signal.
const ACTIVE_PRESET_MONTHS = { '30d': 1, '60d': 2, '90d': 3, '6m': 6, '1y': 12 };
export const activeThreshold = preset => ACTIVE_PRESET_MONTHS[preset] ? ACTIVE_PRESET_MONTHS[preset] * 2 : null;

// Builds a stat-tile "N →" link as a real <button> (focusable, Enter/Space-activatable)
// rather than an innerHTML string — org/company names are committed data, not user input,
// but some do contain quotes (e.g. `Ювелирная сеть "585"`), which would otherwise break out
// of an interpolated aria-label attribute and produce malformed/truncated markup. Building
// the element and assigning the label via setAttribute (rather than string-interpolating
// into markup) sidesteps HTML parsing entirely, so no escaping is needed regardless of what
// characters the name contains.
export function renderStatLinkButton({ count, ariaLabel, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'inline-flex items-center gap-1.5 p-0 border-0 bg-transparent font-bold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors';
  btn.setAttribute('aria-label', ariaLabel);
  btn.append(`${count} `);
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.className = 'text-sm font-normal';
  arrow.textContent = '→';
  btn.append(arrow);
  btn.onclick = onClick;
  return btn;
}
