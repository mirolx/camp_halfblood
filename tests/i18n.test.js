import { beforeEach, describe, expect, test, vi } from 'vitest';

async function freshI18n() {
  vi.resetModules();
  return import('../src/i18n/i18n.js');
}

describe('strings', () => {
  test('ko and en have identical key sets', async () => {
    const { strings } = await import('../src/i18n/strings.js');
    const ko = Object.keys(strings.ko).sort();
    const en = Object.keys(strings.en).sort();
    expect(en).toEqual(ko);
    for (const k of ko) {
      expect(strings.ko[k], `ko.${k}`).toBeTruthy();
      expect(strings.en[k], `en.${k}`).toBeTruthy();
    }
  });
});

describe('i18n', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  test('defaults to ko', async () => {
    const { t, getLang } = await freshI18n();
    expect(getLang()).toBe('ko');
    expect(t('app.title')).toBe('캠프 하프블러드');
  });

  test('setLang switches language and notifies listener once', async () => {
    const { t, setLang, onLangChange } = await freshI18n();
    const fn = vi.fn();
    onLangChange(fn);
    setLang('en');
    expect(t('app.title')).toBe('Camp Half-Blood');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('en');
  });

  test('remembers language across reloads', async () => {
    const a = await freshI18n();
    a.setLang('en');
    const b = await freshI18n();
    expect(b.getLang()).toBe('en');
  });

  test('missing key returns the key itself', async () => {
    const { t } = await freshI18n();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('missing.key')).toBe('missing.key');
  });

  test('substitutes {vars}', async () => {
    const { t } = await freshI18n();
    expect(t('quiz.progress', { n: 3, total: 12 })).toBe('3 / 12');
  });

  test('works when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { setLang, getLang } = await freshI18n();
    expect(getLang()).toBe('ko');
    setLang('en');
    expect(getLang()).toBe('en');
  });

  test('unsubscribe stops notifications', async () => {
    const { setLang, onLangChange } = await freshI18n();
    const fn = vi.fn();
    const off = onLangChange(fn);
    off();
    setLang('en');
    expect(fn).not.toHaveBeenCalled();
  });
});
