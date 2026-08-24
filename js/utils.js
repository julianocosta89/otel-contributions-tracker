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

// Active-contributor threshold: >=10 contributions/month, scaled to the preset's span.
// Only defined for timeframes up to 1y — beyond that, sustaining 10/mo for years is rare
// enough that the split stops being a meaningful signal.
const ACTIVE_PRESET_MONTHS = { '30d': 1, '60d': 2, '90d': 3, '6m': 6, '1y': 12 };
export const activeThreshold = preset => ACTIVE_PRESET_MONTHS[preset] ? ACTIVE_PRESET_MONTHS[preset] * 10 : null;

// Builds a stat-tile "N →" link as a real <button> (focusable, Enter/Space-activatable)
// rather than an innerHTML string — org/company names are committed data, not user input,
// but some do contain quotes (e.g. `Ювелирная сеть "585"`), which would otherwise break out
// of an interpolated aria-label attribute and produce malformed/truncated markup. Building
// the element and assigning the label via setAttribute (rather than string-interpolating
// into markup) sidesteps HTML parsing entirely, so no escaping is needed regardless of what
// characters the name contains.

// Compute contributor/organization dependency metrics locally from leaderboard data.
// Mirrors the LFX contributor-dependency / organization-dependency endpoints:
// finds the minimum number of top entries whose cumulative share reaches 51%,
// then reports that count and their actual percentage of total contributions.
// See: https://insights.linuxfoundation.org/docs/metrics/contributors/#contributor-dependency
export function computeDependency(items) {
  if (!items || !items.length) return null;
  const sorted = [...items].sort((a, b) => b.contributions - a.contributions);
  const total = sorted.reduce((s, c) => s + c.contributions, 0);
  if (total === 0) return null;
  let cumulative = 0;
  let topCount = 0;
  for (const item of sorted) {
    cumulative += item.contributions;
    topCount++;
    if (cumulative / total >= 0.51) break;
  }
  const topPercentage = (cumulative / total) * 100;
  return {
    topCount,
    topPercentage,
    otherCount: sorted.length - topCount,
  };
}

// Health color based on dependency metrics (topPercentage + topCount).
// Green: < 51% (well distributed), Yellow: 51-80% (moderate), Red: > 80% (concentrated).
// Additionally, a very small top count is always a risk regardless of percentage:
//   - topCount ≤ 2 → at least yellow (bus-factor risk)
//   - topCount ≤ 1 → red (single point of failure)
export function dependencyColor(topPercentage, topCount) {
  if (topPercentage == null) return null;
  let color;
  if (topPercentage < 51) color = 'green';
  else if (topPercentage < 80) color = 'yellow';
  else color = 'red';
  // Factor in absolute top count — few contributors/orgs holding the majority
  // is a structural risk even when the percentage is just under a threshold.
  if (topCount <= 1) color = 'red';
  else if (topCount <= 2 && color === 'green') color = 'yellow';
  return color;
}

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
