import { el } from './utils.js';

export const isDark   = () => document.documentElement.classList.contains('dark');
export const C = {
  tick:    () => isDark() ? '#6b7280' : '#64748b',
  grid:    () => isDark() ? '#1f2937' : '#e2e8f0',
  legend:  () => isDark() ? '#9ca3af' : '#374151',
  missing: () => isDark() ? '#374151' : '#e2e8f0',
};

export function initTheme() {
  const saved = localStorage.getItem('otel-theme');
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

export function applyTheme(mode) {
  const html = document.documentElement;
  html.classList.toggle('dark', mode === 'dark');
  el('icon-moon').classList.toggle('hidden', mode === 'light');
  el('icon-sun').classList.toggle('hidden',  mode === 'dark');
  localStorage.setItem('otel-theme', mode);
}

export function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  applyTheme(next);
  document.dispatchEvent(new CustomEvent('themeChanged'));
}
