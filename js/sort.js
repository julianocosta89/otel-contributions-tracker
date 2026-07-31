import { S, SORT_DEFAULTS } from './state.js';

// Text (string) sort keys default to ascending on first click; numeric keys default
// to descending, since "most X" is almost always what people want to see first.
const TEXT_KEYS = new Set(['name', 'company', 'repo']);

function compareValues(a, b) {
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base', numeric: true });
  }
  return (a ?? 0) - (b ?? 0);
}

// Mutates S.sort[tab]: clicking the active key again flips direction; a new key
// picks the default direction for its type.
export function toggleSort(tab, key) {
  const s = S.sort[tab];
  if (s.key === key) {
    s.dir = s.dir === 'desc' ? 'asc' : 'desc';
  } else {
    s.key = key;
    s.dir = TEXT_KEYS.has(key) ? 'asc' : 'desc';
  }
}

export function isDefaultSort(tab) {
  const s = S.sort[tab];
  const d = SORT_DEFAULTS[tab];
  return s.key === d.key && s.dir === d.dir;
}

// accessor(row, key) -> string | number. Index tie-break keeps equal-valued rows in
// their original relative order (stable) instead of shuffling them on every re-sort.
export function sortRows(rows, tab, accessor) {
  const { key, dir } = S.sort[tab];
  return rows
    .map((row, i) => ({ row, i, v: accessor(row, key) }))
    .sort((a, b) => {
      const cmp = compareValues(a.v, b.v);
      return cmp !== 0 ? (dir === 'desc' ? -cmp : cmp) : a.i - b.i;
    })
    .map(x => x.row);
}

// Refreshes the ▲/▼ arrows on a table's sortable column headers after a re-render.
// scopeSelector scopes the query to one table (e.g. '#contrib-table-wrap') since
// different tabs' headers otherwise share no ancestor closer than <body>.
export function updateSortIndicators(scopeSelector, tab) {
  const s = S.sort[tab];
  document.querySelectorAll(`${scopeSelector} [data-sort-key]`).forEach(btn => {
    const active = btn.dataset.sortKey === s.key;
    const arrow = btn.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = active ? (s.dir === 'desc' ? ' ▼' : ' ▲') : '';
    btn.closest('th')?.setAttribute('aria-sort', active ? (s.dir === 'desc' ? 'descending' : 'ascending') : 'none');
  });
}
