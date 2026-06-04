import { ROLES } from './state.js';

export const ROLE_RANK = { maintainer: 4, approver: 3, 'code-owner': 2, triager: 1 };

export const ROLE_STYLE = {
  maintainer:   'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800',
  approver:     'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-800',
  'code-owner': 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800',
  triager:      'bg-slate-200 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700',
};

export function roleFor(githubHandleArray) {
  let best = null;
  for (const h of (githubHandleArray || [])) {
    const entry = ROLES[h.toLowerCase()];
    if (!entry) continue;
    const r = entry.role ?? entry; // support old string format during transition
    if (r && (!best || ROLE_RANK[r] > ROLE_RANK[best])) best = r;
  }
  return best;
}

export function teamsFor(githubHandleArray) {
  const role = roleFor(githubHandleArray);
  if (!role) return [];
  const teams = new Set();
  for (const h of (githubHandleArray || [])) {
    const entry = ROLES[h.toLowerCase()];
    if (!entry || (entry.role ?? entry) !== role) continue;
    for (const t of (entry.teams || [])) teams.add(t);
  }
  return [...teams];
}

export function roleBadge(githubHandleArray, small = false) {
  const role = roleFor(githubHandleArray);
  if (!role) return '';
  const teams = teamsFor(githubHandleArray);
  const px = small ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const teamLinks = teams.map(t =>
    `<div><a href="https://github.com/orgs/open-telemetry/teams/${t}" target="_blank" onclick="event.stopPropagation()" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300">${t}</a></div>`
  ).join('');
  const tooltip = teams.length ? `
    <div class="role-tooltip">
      <div class="role-tooltip-inner">
        <div class="text-slate-400 dark:text-gray-500 mb-1">Teams:</div>
        ${teamLinks}
      </div>
    </div>` : '';
  return `<span class="role-badge-wrap">
    <span class="${px} rounded text-xs ${ROLE_STYLE[role]} cursor-default">${role}</span>
    ${tooltip}
  </span>`;
}
