import { strings } from './strings.js';

const STORAGE_KEY = 'chb.lang';
const LANGS = ['ko', 'en'];
const listeners = new Set();

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

let current = readStored() ?? 'ko';

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage blocked: keep in memory only */
  }
  document.documentElement.lang = lang;
  for (const fn of [...listeners]) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, vars) {
  let s = strings[current][key];
  if (s == null) {
    console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}
