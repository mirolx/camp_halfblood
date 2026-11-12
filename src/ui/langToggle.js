import { getLang, onLangChange, setLang, t } from '../i18n/i18n.js';

export function mountLangToggle(parent) {
  const el = document.createElement('div');
  el.className = 'lang-toggle';
  const buttons = ['ko', 'en'].map((lang) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.lang = lang;
    b.addEventListener('click', () => setLang(lang));
    el.appendChild(b);
    return b;
  });
  const render = () => {
    for (const b of buttons) {
      b.textContent = t(`lang.${b.dataset.lang}`);
      b.classList.toggle('active', b.dataset.lang === getLang());
      b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
    }
  };
  render();
  const off = onLangChange(render);
  parent.appendChild(el);
  return { el, destroy: () => { off(); el.remove(); } };
}
