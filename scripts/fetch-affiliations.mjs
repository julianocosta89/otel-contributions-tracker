#!/usr/bin/env node
// Fetches CNCF gitdm developers_affiliations files and builds a
// githubHandle -> affiliation map, saved to data/affiliations.json.
// Probes files starting at 1 and stops at the first 404, so new
// files are picked up automatically without code changes.

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../data/affiliations.json');

const BASE_URL = 'https://raw.githubusercontent.com/cncf/gitdm/master/developers_affiliations';

// Parse a single affiliation line's date info.
// Returns { from: Date|null, until: Date|null }
function parseDates(line) {
  const fromMatch  = line.match(/from (\d{4}-\d{2}-\d{2})/);
  const untilMatch = line.match(/until (\d{4}-\d{2}-\d{2})/);
  return {
    from:  fromMatch  ? new Date(fromMatch[1])  : null,
    until: untilMatch ? new Date(untilMatch[1]) : null,
  };
}

// Extract the company name (strip date qualifiers from the end of the line).
function companyName(line) {
  return line
    .replace(/\s+from \d{4}-\d{2}-\d{2}(\s+until \d{4}-\d{2}-\d{2})?/, '')
    .replace(/\s+until \d{4}-\d{2}-\d{2}/, '')
    .trim();
}

// Given a block of tab-indented affiliation lines, return all ranges sorted
// in the order they appear in the file (chronological in well-formed gitdm data).
// Dates are stored as ISO strings (YYYY-MM-DD) or null for open-ended boundaries.
export function allRanges(affiliationLines) {
  return affiliationLines.map(e => {
    const { from, until } = parseDates(e.text);
    return {
      company: companyName(e.text),
      from:  from  ? from.toISOString().split('T')[0]  : null,
      until: until ? until.toISOString().split('T')[0] : null,
    };
  });
}

// Return the currently-active company name, or null if no active affiliation.
// "Current" = no "until" date, or "until" date is in the future.
// Among multiple active entries, the one with the latest "from" date wins.
export function activeCompany(affiliationLines) {
  const now = new Date();
  const active = affiliationLines
    .map(e => ({ ...e, ...parseDates(e.text) }))
    .filter(e => !e.until || e.until > now);

  if (!active.length) return null;

  active.sort((a, b) => {
    if (!a.from && !b.from) return 0;
    if (!a.from) return 1;
    if (!b.from) return -1;
    return b.from - a.from;
  });

  return companyName(active[0].text);
}

// Returns the file text, or null if the file does not exist (404).
// Retries on transient errors; does not retry on 404.
async function fetchFile(n, retries = 3) {
  const url = `${BASE_URL}${n}.txt`;
  console.log(`Fetching ${url}…`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`  retrying ${url} (attempt ${attempt + 1})…`);
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

export function parseAffiliations(text, fileNumber) {
  const map = {};
  const lines = text.split('\n');
  let currentHandle = null;
  let handleLineNum = null;
  let affiliationLines = []; // { text, lineNum }

  function flush() {
    if (!currentHandle || !affiliationLines.length) return;
    const company = activeCompany(affiliationLines);
    if (!company) return;

    const lineEnd = affiliationLines[affiliationLines.length - 1].lineNum;
    map[currentHandle] = {
      company,                      // backward compat — currently active company
      ranges: allRanges(affiliationLines),
      file:      fileNumber,
      line:      handleLineNum,     // backward compat alias for lineStart
      lineStart: handleLineNum,
      lineEnd,
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    if (!raw.startsWith('\t') && raw.includes(':')) {
      flush();
      currentHandle = raw.split(':')[0].trim().toLowerCase();
      handleLineNum = lineNum;
      affiliationLines = [];
    } else if (raw.startsWith('\t') && currentHandle) {
      const trimmed = raw.trim();
      if (trimmed) affiliationLines.push({ text: trimmed, lineNum });
    }
  }
  flush();

  return map;
}

async function main() {
  const combined = {};

  // Probe files sequentially, stopping at the first 404.
  // Later-numbered files take precedence when the same handle appears in multiple files.
  let fileCount = 0;
  for (let n = 1; ; n++) {
    const text = await fetchFile(n);
    if (text === null) {
      console.log(`  → file ${n}: not found — done`);
      break;
    }
    const partial = parseAffiliations(text, n);
    Object.assign(combined, partial);
    console.log(`  → file ${n}: ${Object.keys(partial).length} handles`);
    fileCount++;
  }

  console.log(`\nTotal: ${Object.keys(combined).length} handles with current company (from ${fileCount} files)`);
  writeFileSync(OUT_PATH, JSON.stringify(combined, null, 2));
  console.log(`Saved to ${OUT_PATH}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
