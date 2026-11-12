import { h, bindI18n } from './dom.js';

const SILHOUETTE = {
  male: '<svg viewBox="0 0 60 80" aria-hidden="true"><circle cx="30" cy="16" r="10"/><path d="M22 9q8-7 16 0v4H22z"/><path d="M12 78V44q0-12 18-12t18 12v34z"/></svg>',
  female: '<svg viewBox="0 0 60 80" aria-hidden="true"><circle cx="30" cy="16" r="9.5"/><path d="M20 15q0-12 10-12t10 12q6 6 4 18q-4-8-6-14z"/><path d="M15 78V45q0-12 15-12t15 12v33z"/></svg>',
};

export function mountStartScreen(parent, { onStart }) {
  let gender = null;
  const start = h('button', { cls: 'start-button', text: 'start.go', attrs: { type: 'button' } });
  start.disabled = true;

  const cards = ['female', 'male'].map((g) => {
    const card = h('button', { cls: 'gender-card', attrs: { type: 'button', 'data-gender': g } });
    card.innerHTML = SILHOUETTE[g];
    card.appendChild(h('span', { text: `start.${g}` }));
    card.addEventListener('click', () => {
      gender = g;
      for (const c of cards) c.classList.toggle('selected', c === card);
      start.disabled = false;
    });
    return card;
  });

  const root = h('section', { cls: 'screen start-screen' }, [
    h('p', { cls: 'kicker', text: 'start.kicker' }),
    h('h1', { cls: 'title', text: 'app.title' }),
    h('p', { cls: 'lead', text: 'start.lead' }),
    h('p', { cls: 'pick', text: 'start.pick' }),
    h('div', { cls: 'gender-row' }, cards),
    start,
    h('p', { cls: 'hint', text: 'start.sound' }),
  ]);
  start.addEventListener('click', () => gender && onStart(gender));
  const off = bindI18n(root);
  parent.appendChild(root);
  return { destroy: () => { off(); root.remove(); } };
}
