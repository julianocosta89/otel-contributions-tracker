import { el, show, hide } from './utils.js';

export function showError(msg) {
  el('error-msg').textContent = msg;
  show('error-toast');
  setTimeout(hideError, 9000);
}

export function hideError() { hide('error-toast'); }
