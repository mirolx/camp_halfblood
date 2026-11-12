import { describe, expect, test } from 'vitest';
import { SCENES, TOTAL, sceneAt, sceneProgress, timeOfDayAt } from '../src/sim/timeline.js';

describe('timeline', () => {
  test('scenes are contiguous and cover 0..600', () => {
    expect(TOTAL).toBe(600);
    expect(SCENES.map((s) => s.id)).toEqual(['dawn', 'overview', 'training', 'pegasus', 'dinner', 'campfire']);
    expect(SCENES.map((s) => s.start)).toEqual([0, 90, 150, 300, 390, 480]);
    expect(SCENES[0].start).toBe(0);
    expect(SCENES.at(-1).end).toBe(600);
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].start).toBe(SCENES[i - 1].end);
  });

  test('sceneAt boundaries and clamping', () => {
    expect(sceneAt(0).id).toBe('dawn');
    expect(sceneAt(89.9).id).toBe('dawn');
    expect(sceneAt(90).id).toBe('overview');
    expect(sceneAt(599).id).toBe('campfire');
    expect(sceneAt(-5).id).toBe('dawn');
    expect(sceneAt(700).id).toBe('campfire');
  });

  test('sceneProgress is 0..1 within a scene', () => {
    expect(sceneProgress(90)).toBe(0);
    expect(sceneProgress(120)).toBeCloseTo(0.5);
    expect(sceneProgress(700)).toBe(1);
  });

  test('timeOfDayAt is monotonic from 0 to 1', () => {
    expect(timeOfDayAt(0)).toBe(0);
    expect(timeOfDayAt(600)).toBe(1);
    let prev = -1;
    for (let t = 0; t <= 600; t += 0.5) {
      const v = timeOfDayAt(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  test('every scene has a caption key in strings', async () => {
    const { strings } = await import('../src/i18n/strings.js');
    for (const s of SCENES) {
      expect(strings.ko[s.captionKey], s.id).toBeTruthy();
      expect(strings.en[s.captionKey], s.id).toBeTruthy();
    }
  });
});
