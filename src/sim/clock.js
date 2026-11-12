import { SCENES, TOTAL, sceneAt } from './timeline.js';

// Pure playback clock for the day. The director ticks it every frame.
export function createClock({ startAt = 0, speed = 1 } = {}) {
  let t = Math.min(Math.max(startAt, 0), TOTAL);
  let paused = false;
  let ended = t >= TOTAL;
  let scene = sceneAt(t);
  const sceneListeners = new Set();
  const endListeners = new Set();

  function setTime(next) {
    t = Math.min(Math.max(next, 0), TOTAL);
    const s = sceneAt(t);
    if (s !== scene) {
      // fire for every boundary crossed, in order
      const from = SCENES.indexOf(scene);
      const to = SCENES.indexOf(s);
      for (let i = from + 1; i <= to; i++) for (const fn of sceneListeners) fn(SCENES[i]);
      scene = s;
    }
    if (t >= TOTAL && !ended) {
      ended = true;
      for (const fn of endListeners) fn();
    }
  }

  return {
    tick(dt) {
      if (paused || ended || dt <= 0) return;
      setTime(t + dt * speed);
    },
    play() { paused = false; },
    pause() { paused = true; },
    isPaused: () => paused,
    isEnded: () => ended,
    elapsed: () => t,
    scene: () => scene,
    setSpeed(v) { speed = v; },
    seek: setTime,
    skipToNextScene() {
      setTime(scene.end);
    },
    onSceneChange(fn) { sceneListeners.add(fn); return () => sceneListeners.delete(fn); },
    onEnd(fn) { endListeners.add(fn); return () => endListeners.delete(fn); },
  };
}
