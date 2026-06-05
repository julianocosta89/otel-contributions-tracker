import { CACHE, SIGS_CACHE, S, setCache, setSigsCache, _sigsLoadPromise, setSigsLoadPromise } from './state.js';
import { el } from './utils.js';

function showCacheDateTag(isoDate) {
  if (!isoDate) return;
  const tag = el('cache-date-tag');
  const d = new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  tag.textContent = `cached ${d}`;
  tag.classList.remove('hidden');
}

export function usingCache() {
  if (CACHE === null) return false;
  if (S.filters.platform === 'all') return S.preset in CACHE.periods;
  return !!(CACHE.filterCombos?.[S.preset]?.[S.filters.platform]);
}

// Returns the cached data object for the active preset + filters.
export function cacheData() {
  return S.filters.platform === 'all'
    ? CACHE.periods[S.preset]
    : CACHE.filterCombos[S.preset][S.filters.platform];
}

export async function loadCache() {
  try {
    const res = await fetch('./data/cache.json');
    if (!res.ok) return;
    const data = await res.json();
    setCache(data);
    showCacheDateTag(data.fetchedAt);
  } catch {
    // cache not available — use live API
  }
}

// Singleton promise — prevents double-fetching if multiple user actions need
// SIG data at the same time. The request is started on first actual use.
export async function loadSigsCache() {
  if (!_sigsLoadPromise) {
    setSigsLoadPromise((async () => {
      try {
        const res = await fetch('./data/sigs.json');
        setSigsCache(res.ok ? await res.json() : false);
      } catch {
        setSigsCache(false);
      }
    })());
  }
  return _sigsLoadPromise;
}

export function reposFromSigsCache(normalizedHandles) {
  if (!SIGS_CACHE?.periods) return null;
  const periodData = SIGS_CACHE.periods[S.preset];
  if (!periodData) return null;

  const repoMap = new Map();
  for (const [repoName, repoData] of Object.entries(periodData)) {
    let repoTotal = 0;
    for (const c of (repoData.contributors?.data ?? [])) {
      if ((c.githubHandleArray || []).some(h => normalizedHandles.has(h.toLowerCase()))) {
        repoTotal += c.contributions;
      }
    }
    if (repoTotal > 0) {
      const repoUrl = `https://github.com/open-telemetry/${repoName}`;
      repoMap.set(repoUrl, { name: repoName, url: repoUrl, count: repoTotal });
    }
  }
  return [...repoMap.values()].sort((a, b) => b.count - a.count);
}

export function reposFromCache(handles) {
  return reposFromSigsCache(new Set(handles.map(h => h.toLowerCase())));
}

export function orgReposFromCache(contributors) {
  const handles = new Set(
    contributors.flatMap(c => (c.githubHandleArray || []).map(h => h.toLowerCase()))
  );
  return reposFromSigsCache(handles);
}
