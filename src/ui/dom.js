import { onLangChange, t } from '../i18n/i18n.js';

// Create an element; `text` is an i18n key re-rendered on language change via data-i18n.
export function h(tag, { cls, text, attrs } = {}, children = []) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) { el.dataset.i18n = text; el.textContent = t(text); }
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.appendChild(c);
  return el;
}

// Re-translate every [data-i18n] node under root when the language changes.
export function bindI18n(root) {
  return onLangChange(() => {
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  });
}
