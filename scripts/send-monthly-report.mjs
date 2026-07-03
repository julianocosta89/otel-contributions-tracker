#!/usr/bin/env node
/**
 * Sends a monthly Datadog Inc. contribution report email via Resend.
 *
 * Queries LF Insights for the previous full calendar month, attributes
 * contributions to Datadog Inc. using the same gitdm/GitHub-profile
 * affiliation logic the web app uses, and emails a summary: MoM growth,
 * active contributors, contribution concentration, top contributors,
 * leadership-role count, and repository coverage.
 *
 * A small snapshot (data/reports/datadog-monthly-report.json) is written
 * after each successful send so the next run can compute month-over-month
 * deltas without re-querying two months of data.
 *
 * Usage:
 *   node scripts/send-monthly-report.mjs                  # report for last full calendar month, send + save
 *   node scripts/send-monthly-report.mjs --dry-run         # compute + print, skip send and snapshot write
 *   node scripts/send-monthly-report.mjs --month=2026-06   # override target month (testing/backfill)
 *
 * Required env vars (unless --dry-run): RESEND_API_KEY, REPORT_FROM, REPORT_TO
 * Optional env var: GITHUB_TOKEN (raises the GitHub Search API rate limit used for repo lookups)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { enrichWithAttribution } from './enrich-attribution.mjs';
import { setAffiliations, setGhCompanies, setRoles } from '../js/state.js';
import { affiliationFor } from '../js/affiliations.js';
import { roleFor } from '../js/roles.js';
import { companyMatchesOrg, calcOrgConcentration } from '../js/attribution.js';
import { fetchOrgRepos } from '../js/api.js';
import { num, pct } from '../js/utils.js';

const BASE             = 'https://insights.linuxfoundation.org/api/project/opentelemetry';
const TARGET_ORG       = 'Datadog Inc.';
const SNAPSHOT_DIR     = 'data/reports';
const SNAPSHOT_PATH    = `${SNAPSHOT_DIR}/datadog-monthly-report.json`;
const RESEND_ENDPOINT  = 'https://api.resend.com/emails';
const LEADERSHIP_ROLES = new Set(['maintainer', 'approver', 'triager']);
const TOP_N            = 5;
const ACTIVE_THRESHOLD = 2; // matches js/utils.js activeThreshold('30d')

const DRY_RUN        = process.argv.includes('--dry-run');
const monthArg       = process.argv.find(a => a.startsWith('--month='));
const MONTH_OVERRIDE = monthArg ? monthArg.split('=')[1] : null;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── HTTP helpers (mirrors scripts/fetch-data.mjs) ────────────────────────────

async function get(path, params = {}) {
  const qs  = new URLSearchParams(params);
  const url = `${BASE}/${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — GET ${path}`);
  return res.json();
}

async function getAll(path, params = {}) {
  const LIMIT = 200;
  let offset = 0, total = Infinity;
  const all = [];
  while (offset < total) {
    const d = await get(path, { ...params, limit: LIMIT, offset });
    all.push(...(d.data ?? []));
    total  = d.meta?.total ?? all.length;
    offset += LIMIT;
    process.stdout.write(`\r  ${all.length} / ${total}`);
    if (offset < total) await sleep(150);
  }
  process.stdout.write('\n');
  return { total, data: all };
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

// Returns the calendar-month window (ISO strings, both ends inclusive — LF Insights
// and the GitHub Search API both treat `endDate`/`created:a..b` as inclusive, so the
// window's last day must be the month's actual last day, NOT the 1st of next month)
// for the month before `refDate`, or for `override` ("YYYY-MM") when given.
export function monthWindow(refDate, override = null) {
  const pad = n => String(n).padStart(2, '0');
  let year, month0; // month0 is 0-based
  if (override) {
    const m = /^(\d{4})-(\d{2})$/.exec(override);
    if (!m) throw new Error(`Invalid --month value: ${override} (expected YYYY-MM)`);
    year   = +m[1];
    month0 = +m[2] - 1;
    if (month0 < 0 || month0 > 11) throw new Error(`Invalid --month value: ${override} (month must be 01-12)`);
  } else {
    const d = new Date(refDate);
    year   = d.getUTCFullYear();
    month0 = d.getUTCMonth() - 1;
    if (month0 < 0) { month0 = 11; year -= 1; }
  }
  const startDate = `${year}-${pad(month0 + 1)}-01`;
  // Day 0 of the next month == the last day of this month (handles leap years too).
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const endDate = `${year}-${pad(month0 + 1)}-${pad(lastDay)}`;
  return { key: `${year}-${pad(month0 + 1)}`, startDate, endDate };
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[+m - 1]} ${y}`;
}

// Growth of `current` vs `previous`. previous == null means no snapshot yet.
export function computeGrowth(current, previous) {
  if (previous == null) return { status: 'no-baseline' };
  if (previous === 0) return { status: current === 0 ? 'flat' : 'new' };
  return { status: 'ok', value: ((current - previous) / previous) * 100 };
}

// ── Datadog attribution (mirrors js/attribution.js's contributorsForOrg) ─────

function datadogContributionsFor(c) {
  if (c.attributedContributions?.length) {
    return c.attributedContributions
      .filter(a => companyMatchesOrg(a.company, TARGET_ORG))
      .reduce((s, a) => s + a.contributions, 0);
  }
  const aff = affiliationFor(c.githubHandleArray);
  return (aff && companyMatchesOrg(aff.company, TARGET_ORG)) ? c.contributions : 0;
}

// ── Snapshot persistence ──────────────────────────────────────────────────

function loadSnapshot() {
  try { return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')); }
  catch { return null; }
}

function saveSnapshot(data) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2) + '\n');
}

// ── Rendering ─────────────────────────────────────────────────────────────

function growthText(growth) {
  if (growth.status === 'no-baseline') return 'No prior month on record yet — this is the first report.';
  if (growth.status === 'flat')        return 'No change vs last month (0 contributions both months).';
  if (growth.status === 'new')         return 'New activity this month (0 contributions last month).';
  const sign = growth.value > 0 ? '+' : '';
  return `${sign}${pct(growth.value)} vs last month`;
}

function activeDeltaText(activeDelta) {
  if (activeDelta == null) return 'no prior month to compare';
  const sign = activeDelta > 0 ? '+' : '';
  return `${sign}${activeDelta} vs last month`;
}

function concentrationText(concentration) {
  if (concentration.status === 'limited') return 'Not enough GitHub data to assess this month.';
  return `${concentration.label} (HHI ${num(concentration.hhi)}) — top contributor is ${pct(concentration.top1Pct)} of Datadog's activity.`;
}

function renderTextSummary(r) {
  const lines = [
    `Datadog Inc. — OpenTelemetry contribution report — ${r.monthLabel}`,
    `Window: ${r.startDate} → ${r.endDate}`,
    '',
    `Total contributions: ${num(r.orgTotal)} (${growthText(r.growth)})`,
    `Active contributors (>= ${ACTIVE_THRESHOLD}/mo): ${num(r.activeContributors)} (${activeDeltaText(r.activeDelta)})`,
    `Concentration: ${concentrationText(r.concentration)}`,
    `Leadership roles (maintainer/approver/triager): ${num(r.leadershipCount)}`,
    `Repositories contributed to: ${num(r.repoCount)}${r.truncated ? ' (partial — GitHub search truncated)' : ''}${r.failedCount ? ` (⚠ ${r.failedCount} contributor lookup(s) failed — incomplete)` : ''}`,
    '',
    'Top contributors:',
    ...(r.topContributors.length
      ? r.topContributors.map((c, i) => `  ${i + 1}. ${c.name} (${c.githubHandleArray.join(', ')}) — ${num(c.contributions)}`)
      : ['  (none matched)']),
    '',
    'Top repositories:',
    ...(r.topRepos.length
      ? r.topRepos.map((repo, i) => `  ${i + 1}. ${repo.fullName} — ${repo.count} PRs`)
      : ['  (none found)']),
  ];
  return lines.join('\n');
}

// Contributor names, repo names, etc. come from GitHub/LF data and are not
// trusted input — escape before interpolating into the email HTML.
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmailHtml(r) {
  const row = (label, value) => `
    <tr>
      <td style="padding:8px 12px;color:#64748b;font-size:13px;">${label}</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:600;color:#0f172a;">${value}</td>
    </tr>`;

  const contributorRows = r.topContributors.length
    ? r.topContributors.map((c, i) => `
      <tr>
        <td style="padding:6px 12px;color:#64748b;font-size:13px;">${i + 1}</td>
        <td style="padding:6px 12px;font-size:14px;">${escapeHtml(c.name)} <span style="color:#94a3b8;">(${escapeHtml(c.githubHandleArray.join(', '))})</span></td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;">${num(c.contributions)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:6px 12px;color:#94a3b8;font-style:italic;">No contributors matched this month.</td></tr>`;

  const repoRows = r.topRepos.length
    ? r.topRepos.map((repo, i) => `
      <tr>
        <td style="padding:6px 12px;color:#64748b;font-size:13px;">${i + 1}</td>
        <td style="padding:6px 12px;font-size:14px;"><a href="${escapeHtml(repo.htmlUrl)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(repo.fullName)}</a></td>
        <td style="padding:6px 12px;font-size:14px;text-align:right;">${repo.count} PR${repo.count === 1 ? '' : 's'}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:6px 12px;color:#94a3b8;font-style:italic;">No repository activity found this month.</td></tr>`;

  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:20px 24px;background:#0f172a;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;">Datadog Inc. — OpenTelemetry contributions</h1>
        <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${r.monthLabel} · ${r.startDate} → ${r.endDate}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 0;">
        <table role="presentation" width="100%" style="border-collapse:collapse;">
          ${row('Total contributions', `${num(r.orgTotal)} <span style="font-weight:400;color:#64748b;">(${growthText(r.growth)})</span>`)}
          ${row(`Active contributors (&ge;${ACTIVE_THRESHOLD}/mo)`, `${num(r.activeContributors)} <span style="font-weight:400;color:#64748b;">(${activeDeltaText(r.activeDelta)})</span>`)}
          ${row('Contribution concentration', concentrationText(r.concentration))}
          ${row('Leadership roles (maintainer/approver/triager)', num(r.leadershipCount))}
          ${row('Repositories contributed to', `${num(r.repoCount)}${r.truncated ? ' <span style="font-weight:400;color:#f59e0b;">(partial — search truncated)</span>' : ''}${r.failedCount ? ` <span style="font-weight:400;color:#dc2626;">(&#9888; ${r.failedCount} lookup(s) failed — incomplete)</span>` : ''}`)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 4px;">
        <h2 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Top contributors</h2>
        <table role="presentation" width="100%" style="border-collapse:collapse;">${contributorRows}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 24px 24px;">
        <h2 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Top repositories</h2>
        <table role="presentation" width="100%" style="border-collapse:collapse;">${repoRows}</table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Resend ────────────────────────────────────────────────────────────────

async function sendEmail(html, label) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.REPORT_FROM;
  const to     = process.env.REPORT_TO;
  if (!apiKey) throw new Error('RESEND_API_KEY is required to send the report (use --dry-run to skip sending).');
  if (!from || !to) throw new Error('REPORT_FROM and REPORT_TO are required to send the report.');

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [to],
      subject: `OTel × Datadog contribution report — ${label}`,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend API error: HTTP ${res.status} — ${await res.text()}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { key: monthKey, startDate, endDate } = monthWindow(new Date(), MONTH_OVERRIDE);
  const label = monthLabel(monthKey);
  console.log(`Datadog monthly report — ${label} (${startDate} → ${endDate})`);

  console.log('Loading affiliations / roles…');
  const affiliationsRaw = JSON.parse(readFileSync('data/affiliations.json', 'utf8'));
  const ghCompanies     = JSON.parse(readFileSync('data/github-companies.json', 'utf8'));
  const rolesRaw        = JSON.parse(readFileSync('data/roles.json', 'utf8'));
  setAffiliations(affiliationsRaw);
  setGhCompanies(ghCompanies);
  setRoles(rolesRaw.roles ?? {});

  const params = { startDate, endDate, platform: 'all', activityType: 'all' };

  console.log('Fetching contributor leaderboard…');
  const contributors = await getAll('contributors/contributor-leaderboard', params);
  console.log(`  ✓ ${contributors.data.length} contributors`);

  console.log('Fetching organization leaderboard…');
  const organizations = await getAll('contributors/organization-leaderboard', params);
  console.log(`  ✓ ${organizations.data.length} organizations`);

  console.log('Enriching attribution for employer changes within the month…');
  await enrichWithAttribution(contributors, startDate, endDate, affiliationsRaw, { apiGet: get, apiSleep: sleep });

  const datadogContribs = contributors.data
    .map(c => ({ ...c, contributions: datadogContributionsFor(c) }))
    .filter(c => c.contributions > 0)
    .sort((a, b) => b.contributions - a.contributions);

  const orgEntry     = organizations.data.find(o => companyMatchesOrg(o.name, TARGET_ORG));
  const summedTotal  = datadogContribs.reduce((s, c) => s + c.contributions, 0);
  const orgTotal     = orgEntry ? orgEntry.contributions : summedTotal;

  const activeContributors = datadogContribs.filter(c => c.contributions >= ACTIVE_THRESHOLD).length;
  const concentration      = calcOrgConcentration(datadogContribs, orgTotal);
  const topContributors    = datadogContribs.slice(0, TOP_N);
  const leadershipCount    = datadogContribs.filter(c => LEADERSHIP_ROLES.has(roleFor(c.githubHandleArray))).length;

  console.log('Fetching repository activity via GitHub Search API…');
  const { repos, truncated, failedCount } = await fetchOrgRepos(datadogContribs, TARGET_ORG, startDate, endDate, process.env.GITHUB_TOKEN);
  if (failedCount > 0) console.warn(`  ⚠ ${failedCount} contributor(s)' repo search failed — repo count/top repos are incomplete this month.`);
  const topRepos = repos.slice(0, TOP_N);

  const snapshot     = loadSnapshot();
  const growth       = computeGrowth(orgTotal, snapshot?.totalContributions ?? null);
  const activeDelta  = snapshot ? activeContributors - snapshot.activeContributors : null;

  const report = {
    monthKey, monthLabel: label, startDate, endDate,
    orgTotal, activeContributors, concentration, topContributors,
    leadershipCount, repoCount: repos.length, topRepos, truncated, failedCount,
    growth, activeDelta,
  };

  if (DRY_RUN) {
    console.log(`\n${renderTextSummary(report)}\n\n--dry-run: skipped email send and snapshot write.`);
    return;
  }

  console.log('Sending email via Resend…');
  await sendEmail(renderEmailHtml(report), label);
  saveSnapshot({ month: monthKey, totalContributions: orgTotal, activeContributors, generatedAt: new Date().toISOString() });
  console.log('Report sent and snapshot updated.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error('\nReport failed:', e.message); process.exit(1); });
}
