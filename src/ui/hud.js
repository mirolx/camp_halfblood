import { h, bindI18n } from './dom.js';
import { onLangChange, t } from '../i18n/i18n.js';

const ICONS = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 5l10 7-10 7zM19 5v14"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
};

const iconButton = (cls) => h('button', { cls: `hud-btn ${cls}`, attrs: { type: 'button' } });

function label(btn, icon, key) {
  btn.innerHTML = icon;
  btn.title = t(key);
  btn.setAttribute('aria-label', btn.title);
}

/** Minimal corner controls + scene captions. Hides after 3s without mouse movement. */
export function mountHud(parent, { director, cameras, audio }) {
  const view = iconButton('hud-view');
  const pause = iconButton('hud-pause');
  const next = iconButton('hud-next');
  const mute = iconButton('hud-mute');
  const volume = h('input', { cls: 'hud-volume', attrs: { type: 'range', min: '0', max: '1', step: '0.05', value: '0.8', 'aria-label': 'volume' } });
  const caption = h('div', { cls: 'scene-caption' });
  const hint = h('div', { cls: 'hud-hint', text: 'hud.hint' });
  const flash = h('div', { cls: 'view-flash' });
  let muted = false;
  let captionKey = null;

  const controls = h('div', { cls: 'hud-controls' }, [view, pause, next, h('div', { cls: 'hud-sound' }, [mute, volume])]);
  const root = h('div', { cls: 'hud' }, [flash, caption, hint, controls]);

  function render() {
    const first = cameras.mode === 'first';
    label(view, first ? ICONS.map : ICONS.eye, first ? 'hud.view.overview' : 'hud.view.first');
    label(pause, director.isPaused() ? ICONS.play : ICONS.pause, director.isPaused() ? 'hud.play' : 'hud.pause');
    label(next, ICONS.next, 'hud.next');
    label(mute, muted ? ICONS.muted : ICONS.sound, muted ? 'hud.unmute' : 'hud.mute');
    if (captionKey) caption.textContent = t(captionKey);
  }

  let flashTimer = null;
  const toggleView = () => {
    // the camera cuts instantly; a quick dip to black hides the jump
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flash.classList.remove('on'), 500);
    cameras.toggle();
    render();
  };
  const togglePause = () => {
    if (director.isPaused()) director.play();
    else director.pause();
    render();
  };
  view.addEventListener('click', toggleView);
  pause.addEventListener('click', togglePause);
  next.addEventListener('click', () => director.skipToNextScene());
  mute.addEventListener('click', () => { muted = !muted; audio?.mute(muted); render(); });
  volume.addEventListener('input', () => audio?.setVolume(Number(volume.value)));

  let idleTimer = null;
  const wake = () => {
    root.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => root.classList.add('idle'), 3000);
  };
  const onKey = (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'v' || e.key === 'V') toggleView();
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'n' || e.key === 'N') director.skipToNextScene();
    wake();
  };
  window.addEventListener('mousemove', wake);
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', onKey);
  wake();

  let captionTimer = null;
  const showCaption = (scene) => {
    captionKey = scene.captionKey;
    caption.textContent = t(captionKey);
    caption.classList.add('show');
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => caption.classList.remove('show'), 4000);
  };
  const offScene = director.onSceneChange(showCaption);
  const offLang = onLangChange(render);
  const offI18n = bindI18n(root);

  render();
  parent.appendChild(root);

  return {
    showCaption,
    destroy() {
      clearTimeout(idleTimer);
      clearTimeout(flashTimer);
      clearTimeout(captionTimer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', onKey);
      offScene();
      offLang();
      offI18n();
      root.remove();
    },
  };
}
