import { describe, expect, test, vi } from 'vitest';
import { createClock } from '../src/sim/clock.js';

describe('clock', () => {
  test('skipToNextScene from 100s jumps to 150', () => {
    const c = createClock({ startAt: 100 });
    c.skipToNextScene();
    expect(c.elapsed()).toBe(150);
  });

  test('skip during campfire ends the day', () => {
    const onEnd = vi.fn();
    const c = createClock({ startAt: 500 });
    c.onEnd(onEnd);
    c.skipToNextScene();
    expect(c.elapsed()).toBe(600);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('paused clock does not advance', () => {
    const c = createClock();
    c.pause();
    c.tick(5);
    expect(c.elapsed()).toBe(0);
    expect(c.isPaused()).toBe(true);
    c.play();
    c.tick(5);
    expect(c.elapsed()).toBe(5);
  });

  test('dt of 0 (hidden tab) does not advance', () => {
    const c = createClock();
    c.tick(0);
    expect(c.elapsed()).toBe(0);
  });

  test('onSceneChange fires once per boundary in order', () => {
    const c = createClock();
    const seen = [];
    c.onSceneChange((s) => seen.push(s.id));
    for (let i = 0; i < 700; i++) c.tick(1);
    expect(seen).toEqual(['overview', 'training', 'pegasus', 'dinner', 'campfire']);
  });

  test('onEnd fires once when reaching 600 and clock stops', () => {
    const c = createClock({ startAt: 590 });
    const onEnd = vi.fn();
    c.onEnd(onEnd);
    c.tick(20);
    c.tick(20);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(c.elapsed()).toBe(600);
  });

  test('speed multiplier scales time', () => {
    const c = createClock({ speed: 4 });
    c.tick(1);
    expect(c.elapsed()).toBe(4);
  });
});
