#!/usr/bin/env node
// Fetches CNCF gitdm developers_affiliations files and builds a
// githubHandle -> currentCompany map, saved to data/affiliations.json

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../data/affiliations.json');

const BASE_URL = 'https://raw.githubusercontent.com/cncf/gitdm/master/developers_affiliations';
const FILE_COUNT = 10;

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

// Extract the company name (strip date qualifiers from the end of the line)
function companyName(line) {
  return line
    .replace(/\s+from \d{4}-\d{2}-\d{2}(\s+until \d{4}-\d{2}-\d{2})?/, '')
    .replace(/\s+until \d{4}-\d{2}-\d{2}/, '')
    .trim();
}

// Given a block of tab-indented affiliation lines (each with { text, lineNum }),
// return { company, lineNum } for the current affiliation, or null.
// "Current" = no "until" date (or until date is in the future).
// Among multiple current entries, pick the one with the latest "from" date.
function currentCompanyEntry(affiliationLines) {
  const now = new Date();
  const active = affiliationLines
    .map(e => ({ ...e, ...parseDates(e.text) }))
    .filter(e => !e.until || e.until > now);

  if (!active.length) return null;

  // Sort by "from" date descending — null (no from) treated as earliest
  active.sort((a, b) => {
    if (!a.from && !b.from) return 0;
    if (!a.from) return 1;
    if (!b.from) return -1;
    return b.from - a.from;
  });

  return { company: companyName(active[0].text), lineNum: active[0].lineNum };
}

async function fetchFile(n, retries = 3) {
  const url = `${BASE_URL}${n}.txt`;
  console.log(`Fetching ${url}…`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`  retrying ${url} (attempt ${attempt + 1})…`);
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

function parseAffiliations(text, fileNumber) {
  const map = {};
  const lines = text.split('\n');
  let currentHandle = null;
  let affiliationLines = []; // { text, lineNum }

  function flush() {
    if (currentHandle && affiliationLines.length) {
      const entry = currentCompanyEntry(affiliationLines);
      if (entry) map[currentHandle] = { company: entry.company, file: fileNumber, line: entry.lineNum };
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    if (!raw.startsWith('\t') && raw.includes(':')) {
      flush();
      // New entry: "handle: email1, email2"
      const handle = raw.split(':')[0].trim().toLowerCase();
      currentHandle = handle;
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

  const results = await Promise.all(
    Array.from({ length: FILE_COUNT }, (_, i) => i + 1).map(async n => {
      const text = await fetchFile(n);
      return { n, partial: parseAffiliations(text, n) };
    })
  );

  for (const { n, partial } of results.sort((a, b) => a.n - b.n)) {
    Object.assign(combined, partial);
    console.log(`  → file ${n}: ${Object.keys(partial).length} handles`);
  }

  console.log(`\nTotal: ${Object.keys(combined).length} handles with current company`);
  writeFileSync(OUT_PATH, JSON.stringify(combined, null, 2));
  console.log(`Saved to ${OUT_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
