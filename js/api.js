import { API_BASE } from './config.js';
import { S } from './state.js';

export function buildQS(extra = {}) {
  return new URLSearchParams({
    startDate: S.filters.startDate, endDate: S.filters.endDate,
    platform: S.filters.platform, activityType: 'all',
    ...extra,
  }).toString();
}

export async function liveApi(path, extra = {}) {
  const res = await fetch(`${API_BASE}/${path}?${buildQS(extra)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  return res.json();
}

export async function fetchContribRepos(handles, startDate, endDate) {
  const handle = handles[0]; // primary handle
  const dateFilter = `${startDate}..${endDate}`;

  // Use GitHub Issues Search API: PRs authored by the contributor in open-telemetry org
  const q = encodeURIComponent(`author:${handle} org:open-telemetry is:pr created:${dateFilter}`);
  const url = `https://api.github.com/search/issues?q=${q}&per_page=100&sort=created&order=desc`;

  const res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } });
  if (res.status === 403) throw new Error('GitHub rate limit reached. Try again in a minute.');
  if (!res.ok) throw new Error(`GitHub API error: HTTP ${res.status}`);

  const data = await res.json();
  if (data.message) throw new Error(data.message); // e.g. API abuse detection

  // Group PRs by repository
  const repoMap = new Map();
  for (const item of data.items) {
    // repository_url: "https://api.github.com/repos/open-telemetry/opentelemetry-java"
    const parts    = item.repository_url.split('/');
    const repoName = parts[parts.length - 1];
    const repoOrg  = parts[parts.length - 2];
    const key      = `${repoOrg}/${repoName}`;
    if (!repoMap.has(key)) {
      repoMap.set(key, { fullName: key, name: repoName, count: 0, htmlUrl: `https://github.com/${key}` });
    }
    repoMap.get(key).count++;
  }

  return {
    totalPRs: data.total_count,
    truncated: data.total_count > 100,
    repos: [...repoMap.values()].sort((a, b) => b.count - a.count),
    searchUrl: `https://github.com/search?q=author%3A${handle}+org%3Aopen-telemetry+is%3Apr+created%3A${dateFilter}&type=pullrequests`,
  };
}

export async function fetchOrgRepos(contributors, org, startDate, endDate) {
  // Fetch repos for each contributor in parallel, then merge
  const results = await Promise.allSettled(
    contributors.map(c => fetchContribRepos(c.githubHandleArray, startDate, endDate))
  );

  const repoMap = new Map();
  let totalPRs  = 0;
  let truncated = false;

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    totalPRs  += r.value.totalPRs;
    if (r.value.truncated) truncated = true;
    for (const repo of r.value.repos) {
      if (repoMap.has(repo.fullName)) {
        repoMap.get(repo.fullName).count += repo.count;
      } else {
        repoMap.set(repo.fullName, { ...repo });
      }
    }
  }

  return {
    repos: [...repoMap.values()].sort((a, b) => b.count - a.count),
    totalPRs,
    truncated,
  };
}
