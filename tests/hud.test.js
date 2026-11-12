import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

let mountHud, mountEndScreen, strings;

function fakes() {
  const sceneFns = new Set();
  let paused = false;
  const director = {
    pause: vi.fn(() => { paused = true; }),
    play: vi.fn(() => { paused = false; }),
    isPaused: () => paused,
    skipToNextScene: vi.fn(),
    onSceneChange: (fn) => { sceneFns.add(fn); return () => sceneFns.delete(fn); },
    emitScene: (s) => sceneFns.forEach((f) => f(s)),
  };
  const cameras = { mode: 'overview', toggle: vi.fn(function () { this.mode = this.mode === 'first' ? 'overview' : 'first'; }) };
  const audio = { setVolume: vi.fn(), mute: vi.fn() };
  return { director, cameras, audio };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  ({ mountHud } = await import('../src/ui/hud.js'));
  ({ mountEndScreen } = await import('../src/ui/endScreen.js'));
  ({ strings } = await import('../src/i18n/strings.js'));
});
afterEach(() => vi.useRealTimers());

const app = () => document.getElementById('app');

describe('hud', () => {
  test('hides after 3s without mouse movement and reappears on move', () => {
    const f = fakes();
    mountHud(app(), f);
    const hud = app().querySelector('.hud');
    expect(hud.classList.contains('idle')).toBe(false);
    vi.advanceTimersByTime(3100);
    expect(hud.classList.contains('idle')).toBe(true);
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(hud.classList.contains('idle')).toBe(false);
  });

  test('scene caption shows on scene change, then fades after 4s', () => {
    const f = fakes();
    mountHud(app(), f);
    f.director.emitScene({ id: 'training', captionKey: 'scene.training' });
    const cap = app().querySelector('.scene-caption');
    expect(cap.textContent).toBe(strings.ko['scene.training']);
    expect(cap.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(4100);
    expect(cap.classList.contains('show')).toBe(false);
  });

  test('view button and V key toggle the camera mode', () => {
    const f = fakes();
    mountHud(app(), f);
    app().querySelector('.hud-view').click();
    expect(f.cameras.toggle).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    expect(f.cameras.toggle).toHaveBeenCalledTimes(2);
  });

  test('Space and the pause button toggle pause', () => {
    const f = fakes();
    mountHud(app(), f);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(f.director.pause).toHaveBeenCalledTimes(1);
    app().querySelector('.hud-pause').click();
    expect(f.director.play).toHaveBeenCalledTimes(1);
  });

  test('next-scene button skips', () => {
    const f = fakes();
    mountHud(app(), f);
    app().querySelector('.hud-next').click();
    expect(f.director.skipToNextScene).toHaveBeenCalledTimes(1);
  });

  test('volume slider and mute reach audio', () => {
    const f = fakes();
    mountHud(app(), f);
    const slider = app().querySelector('.hud-volume');
    slider.value = '0.3';
    slider.dispatchEvent(new Event('input'));
    expect(f.audio.setVolume).toHaveBeenCalledWith(0.3);
    app().querySelector('.hud-mute').click();
    expect(f.audio.mute).toHaveBeenCalledWith(true);
  });

  test('destroy removes listeners', () => {
    const f = fakes();
    const h = mountHud(app(), f);
    h.destroy();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    expect(f.cameras.toggle).not.toHaveBeenCalled();
  });
});

describe('end screen', () => {
  test('replay and retake buttons call back', () => {
    const onReplay = vi.fn();
    const onRetake = vi.fn();
    mountEndScreen(app(), { onReplay, onRetake });
    app().querySelector('.end-replay').click();
    app().querySelector('.end-retake').click();
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onRetake).toHaveBeenCalledTimes(1);
  });
});
