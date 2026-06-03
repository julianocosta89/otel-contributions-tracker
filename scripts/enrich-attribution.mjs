// Enriches contributor leaderboard data with time-split affiliation attribution.
//
// For contributors whose gitdm affiliation changed within the query window:
//   - Top-N: actual contribution counts from sub-period LFX API calls
//   - Rest:  proportional split by days
//
// Mutates contributors.data in place — adds attributedContributions[] to split
// contributors only. Contributors with a single company are left untouched.

export const TOP_N = 100;
export const PAGE_DEPTH_CAP = 1000; // max contributors to scan per sub-period call

// ── Date helpers ──────────────────────────────────────────────────

export function daysBetween(isoStart, isoEnd) {
  return (new Date(isoEnd) - new Date(isoStart)) / 86_400_000;
}

// All ranges from `ranges` that overlap (startDate, endDate).
// Overlap: range starts before window ends AND range ends after window starts.
export function intersectingRanges(ranges, startDate, endDate) {
  return ranges.filter(r =>
    (r.from  === null || r.from  < endDate) &&
    (r.until === null || r.until > startDate)
  );
}

// Splits [startDate, endDate] at each date in splitDates (sorted), returning
// an array of [subStart, subEnd] pairs that together cover the full window.
export function buildSubWindows(startDate, splitDates, endDate) {
  const pts = [startDate, ...splitDates.filter(d => d > startDate && d < endDate), endDate];
  const windows = [];
  for (let i = 0; i < pts.length - 1; i++) windows.push([pts[i], pts[i + 1]]);
  return windows;
}

// Clamp a range's open-ended boundary to the query window.
// r.from = null means "from the beginning" → clamp to startDate.
// r.until = null means "ongoing"           → clamp to endDate.
export function clampRange(r, startDate, endDate) {
  const from  = (r.from  && r.from  > startDate) ? r.from  : startDate;
  const until = (r.until && r.until < endDate)   ? r.until : endDate;
  return { from, until };
}

// ── LFX fetching ─────────────────────────────────────────────────

// Pages the contributor leaderboard for [swStart, swEnd] until all targetHandles
// (lowercase) are found or PAGE_DEPTH_CAP contributors have been scanned.
// Returns a Map<lowercaseHandle, contributorObject>.
async function fetchSubPeriod(apiGet, apiSleep, swStart, swEnd, targetHandles) {
  const LIMIT  = 200;
  const params = { startDate: swStart, endDate: swEnd, platform: 'all', activityType: 'all' };
  let   offset = 0, total = Infinity;
  const found     = new Map();
  const remaining = new Set(targetHandles);

  while (offset < total && offset < PAGE_DEPTH_CAP && remaining.size > 0) {
    const d     = await apiGet('contributors/contributor-leaderboard', { ...params, limit: LIMIT, offset });
    const items = d.data ?? [];
    total = d.meta?.total ?? (offset + items.length);

    for (const c of items) {
      for (const h of (c.githubHandleArray || [])) {
        const lh = h.toLowerCase();
        if (remaining.has(lh)) {
          found.set(lh, c);
          remaining.delete(lh);
        }
      }
    }
    offset += LIMIT;
    if (offset < total && remaining.size > 0) await apiSleep(150);
  }

  if (remaining.size > 0) {
    console.warn(`    ⚠ ${remaining.size} contributor(s) not found within depth cap — proportional fallback: ${[...remaining].join(', ')}`);
  }
  return found;
}

// ── Main export ───────────────────────────────────────────────────

// Mutates contributors.data in place.
// affiliations: the parsed data/affiliations.json object.
// { apiGet, apiSleep }: injected for testability.
export async function enrichWithAttribution(contributors, startDate, endDate, affiliations, { apiGet, apiSleep }) {
  const totalDays = daysBetween(startDate, endDate);
  if (totalDays <= 0) return;

  const top  = contributors.data.slice(0, TOP_N);
  const rest = contributors.data.slice(TOP_N);

  function findEntry(githubHandleArray) {
    for (const h of (githubHandleArray || [])) {
      const entry = affiliations[h.toLowerCase()];
      if (entry?.ranges) return entry;
    }
    return null;
  }

  // ── Top-N: actual sub-period calls ───────────────────────────

  const splitTop = [];
  for (const c of top) {
    const entry = findEntry(c.githubHandleArray);
    if (!entry) continue;
    const overlapping = intersectingRanges(entry.ranges, startDate, endDate);
    if (overlapping.length > 1) splitTop.push({ c, overlapping });
  }

  if (splitTop.length > 0) {
    // Collect all boundary dates that fall strictly inside the window.
    const splitDatesSet = new Set();
    for (const { overlapping } of splitTop) {
      for (const r of overlapping) {
        if (r.from  && r.from  > startDate && r.from  < endDate) splitDatesSet.add(r.from);
        if (r.until && r.until > startDate && r.until < endDate) splitDatesSet.add(r.until);
      }
    }
    const splitDates = [...splitDatesSet].sort();
    const subWindows = buildSubWindows(startDate, splitDates, endDate);

    const targetHandles = new Set(
      splitTop.flatMap(({ c }) => (c.githubHandleArray || []).map(h => h.toLowerCase()))
    );

    // Fetch each sub-window leaderboard; key = "swStart|swEnd"
    const subResults = {};
    for (const [swStart, swEnd] of subWindows) {
      console.log(`    Attribution sub-period ${swStart} → ${swEnd}…`);
      subResults[`${swStart}|${swEnd}`] = await fetchSubPeriod(
        apiGet, apiSleep, swStart, swEnd, targetHandles
      );
      await apiSleep(300);
    }

    // Attach attributedContributions to each split contributor.
    //
    // Two-pass to handle two edge cases:
    //
    //   1. Range spans multiple sub-windows — when contributors have different split dates,
    //      sub-windows are finer than any single affiliation range. We sum across every
    //      sub-window contained within [from, until] rather than looking up one exact key.
    //
    //   2. Conservation — when some ranges have actual data and others fall back to
    //      proportional, the fallback budget is (c.contributions − actualTotal) so that
    //      actual + proportional always sums to the contributor's total.
    for (const { c, overlapping } of splitTop) {
      // Pass 1: resolve actual counts per affiliation range.
      const rangeData = overlapping.map(r => {
        const { from, until } = clampRange(r, startDate, endDate);
        const coveringWindows = subWindows.filter(([swS, swE]) => swS >= from && swE <= until);
        let actualSum = 0;
        let allFound  = coveringWindows.length > 0;
        for (const [swS, swE] of coveringWindows) {
          const swData = subResults[`${swS}|${swE}`];
          const match  = swData && (c.githubHandleArray || [])
            .map(h => swData.get(h.toLowerCase()))
            .find(Boolean);
          if (match) actualSum += match.contributions;
          else allFound = false;
        }
        return { r, from, until, actualSum, isActual: allFound };
      });

      // Pass 2: distribute the remaining budget among proportional-fallback ranges.
      const actualTotal    = rangeData.filter(d => d.isActual).reduce((s, d) => s + d.actualSum, 0);
      const fallbackBudget = c.contributions - actualTotal;
      const fallbackDays   = rangeData
        .filter(d => !d.isActual)
        .reduce((s, d) => s + daysBetween(d.from, d.until), 0);

      c.attributedContributions = rangeData.map(({ r, from, until, actualSum, isActual }) => {
        if (isActual) {
          return { company: r.company, from, until, contributions: actualSum, method: 'actual' };
        }
        const days = daysBetween(from, until);
        return {
          company: r.company, from, until,
          contributions: fallbackDays > 0
            ? Math.round(fallbackBudget * (days / fallbackDays))
            : Math.round(c.contributions * (days / totalDays)),
          method: 'proportional',
        };
      });
    }
  }

  // ── Rest (101+): proportional split ──────────────────────────

  for (const c of rest) {
    const entry = findEntry(c.githubHandleArray);
    if (!entry) continue;
    const overlapping = intersectingRanges(entry.ranges, startDate, endDate);
    if (overlapping.length <= 1) continue;

    c.attributedContributions = overlapping.map(r => {
      const { from, until } = clampRange(r, startDate, endDate);
      const days = daysBetween(from, until);
      return {
        company: r.company, from, until,
        contributions: Math.round(c.contributions * (days / totalDays)),
        method: 'proportional',
      };
    });
  }
}
