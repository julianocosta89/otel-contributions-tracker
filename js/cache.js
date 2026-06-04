import { CACHE, SIGS_CACHE, S, setCache, setSigsCache, _sigsLoadPromise, setSigsLoadPromise } from './state.js';
import { el } from './utils.js';

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

export function cacheSource() {
  if (!CACHE?.sources) return null;
  return S.filters.platform === 'all'
    ? CACHE.sources.periods?.[S.preset]
    : CACHE.sources.filterCombos?.[S.preset]?.[S.filters.platform];
}

export function showSourceBadge(source, isoDate, details = null) {
  const badge = el('source-badge');
  badge.classList.remove('hidden');
  if (source === 'cache') {
    const d = isoDate ? new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const status = details?.status;
    const isFallback = status === 'cached-fallback' || status === 'partial';
    const label = status === 'cached-fallback' ? 'fallback' : status === 'partial' ? 'partial' : 'cached';
    badge.className = isFallback
      ? 'text-xs px-2 py-0.5 rounded-full border font-medium border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400'
      : 'text-xs px-2 py-0.5 rounded-full border font-medium border-slate-300 dark:border-gray-700 text-slate-500 dark:text-gray-400';
    badge.textContent = `${label} ${d}`;
    badge.title = details?.error
      ? `Using cached fallback from ${d}: ${details.error}`
      : details?.fallbackRepos?.length
        ? `Partial refresh; ${details.fallbackRepos.length} repo(s) reused cached data`
        : '';
  } else {
    badge.className = 'text-xs px-2 py-0.5 rounded-full border font-medium border-green-800 text-green-600 dark:text-green-400';
    badge.textContent = 'live';
    badge.title = '';
  }
}

export function showCurrentSourceBadge() {
  if (!usingCache()) {
    showSourceBadge('live');
    return;
  }
  const source = cacheSource();
  showSourceBadge('cache', source?.fetchedAt ?? CACHE?.fetchedAt, source);
}

export async function loadCache() {
  try {
    const res = await fetch('./data/cache.json');
    if (!res.ok) return;
    setCache(await res.json());
    showCurrentSourceBadge();
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
