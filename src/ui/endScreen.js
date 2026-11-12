import { h, bindI18n } from './dom.js';

export function mountEndScreen(parent, { onReplay, onRetake }) {
  const replay = h('button', { cls: 'start-button end-replay', text: 'end.replay', attrs: { type: 'button' } });
  const retake = h('button', { cls: 'ghost-button end-retake', text: 'end.retake', attrs: { type: 'button' } });
  replay.addEventListener('click', () => onReplay());
  retake.addEventListener('click', () => onRetake());
  const root = h('section', { cls: 'screen end-screen' }, [
    h('h2', { cls: 'end-title', text: 'end.title' }),
    h('p', { cls: 'end-lead', text: 'end.lead' }),
    h('div', { cls: 'end-actions' }, [replay, retake]),
  ]);
  const off = bindI18n(root);
  parent.appendChild(root);
  return { destroy: () => { off(); root.remove(); } };
}
