import { AFFILIATIONS, GH_COMPANIES, setAffiliations, setGhCompanies, setRoles } from './state.js';

// Returns { company, source, file?, lineStart?, lineEnd? } where source is 'gitdm' or 'github', or null.
// Always reflects the currently-active affiliation. For time-windowed attribution use affiliationsInWindow().
export function affiliationFor(githubHandleArray) {
  for (const h of (githubHandleArray || [])) {
    const entry = AFFILIATIONS[h.toLowerCase()];
    if (!entry) continue;
    return {
      company:   entry.company,
      source:    'gitdm',
      file:      entry.file,
      lineStart: entry.lineStart,
      lineEnd:   entry.lineEnd,
    };
  }
  for (const h of (githubHandleArray || [])) {
    const company = GH_COMPANIES[h.toLowerCase()];
    if (company) return { company, source: 'github' };
  }
  return null;
}

// Returns all gitdm affiliation ranges that overlap [startDate, endDate) (ISO strings).
// Each item: { company, from, until, source, file, lineStart, lineEnd }
// Returns [] when no gitdm entry exists for any handle (GitHub-only affiliations have no date ranges).
export function affiliationsInWindow(githubHandleArray, startDate, endDate) {
  for (const h of (githubHandleArray || [])) {
    const entry = AFFILIATIONS[h.toLowerCase()];
    if (!entry?.ranges) continue;
    const matches = entry.ranges.filter(r =>
      (r.from === null  || r.from  < endDate) &&
      (r.until === null || r.until > startDate)
    );
    if (!matches.length) continue;
    return matches.map(r => ({
      company:   r.company,
      from:      r.from,
      until:     r.until,
      source:    'gitdm',
      file:      entry.file,
      lineStart: entry.lineStart,
      lineEnd:   entry.lineEnd,
    }));
  }
  return [];
}

export async function loadAffiliations() {
  try {
    const [r1, r2, r3] = await Promise.all([
      fetch('./data/affiliations.json'),
      fetch('./data/github-companies.json'),
      fetch('./data/roles.json'),
    ]);
    if (r1.ok) setAffiliations(await r1.json());
    if (r2.ok) setGhCompanies(await r2.json());
    if (r3.ok) { const d = await r3.json(); setRoles(d.roles ?? {}); }
  } catch { /* optional enrichment, silent fail */ }
}
