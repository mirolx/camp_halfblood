import { describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SOUNDS } from '../src/audio/manifest.js';
import { createAudio } from '../src/audio/engine.js';

// Minimal Web Audio stand-in that records what the engine asks for.
function fakeContext() {
  const param = (v = 1) => ({
    value: v,
    target: v,
    setTargetAtTime(x) { this.target = x; },
    cancelScheduledValues() {},
    setValueAtTime(x) { this.value = x; this.target = x; },
    linearRampToValueAtTime(x) { this.target = x; },
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const ctx = {
    currentTime: 0,
    state: 'suspended',
    destination: node(),
    listener: { positionX: param(0), positionY: param(0), positionZ: param(0), forwardX: param(0), forwardY: param(0), forwardZ: param(-1), upX: param(0), upY: param(1), upZ: param(0) },
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    createGain: () => ({ ...node(), gain: param(1) }),
    createPanner: () => ({ ...node(), positionX: param(0), positionY: param(0), positionZ: param(0) }),
    createBufferSource: () => {
      const s = { ...node(), buffer: null, loop: false, playbackRate: param(1), start: vi.fn(), stop: vi.fn(), onended: null };
      ctx.sources.push(s);
      return s;
    },
    decodeAudioData: vi.fn(async () => ({ duration: 4 })),
    sources: [],
  };
  return ctx;
}

function fakeFetch(missing = []) {
  return vi.fn(async (url) => ({
    ok: !missing.some((m) => url.endsWith(m)),
    status: missing.some((m) => url.endsWith(m)) ? 404 : 200,
    arrayBuffer: async () => new ArrayBuffer(8),
  }));
}

const SAMPLE = [
  { id: 'birds', file: 'sfx/birds.mp3', kind: 'ambient', scenes: ['dawn', 'overview'], volume: 0.6 },
  { id: 'fire', file: 'sfx/fire.mp3', kind: 'ambient', scenes: ['campfire'], volume: 0.8 },
  { id: 'conch', file: 'sfx/conch.mp3', kind: 'oneshot', scenes: ['dawn'], at: 0.05, volume: 1 },
];

describe('audio engine', () => {
  test('load reports failed files without throwing', async () => {
    const ctx = fakeContext();
    const audio = createAudio({ context: () => ctx, fetch: fakeFetch(['conch.mp3']) });
    const res = await audio.load(SAMPLE);
    expect(res.failed).toEqual(['conch']);
    expect(res.loaded.sort()).toEqual(['birds', 'fire']);
  });

  test('playOneShot on a failed id is a no-op', async () => {
    const ctx = fakeContext();
    const audio = createAudio({ context: () => ctx, fetch: fakeFetch(['conch.mp3']) });
    await audio.load(SAMPLE);
    const before = ctx.sources.length;
    expect(() => audio.playOneShot('conch')).not.toThrow();
    expect(() => audio.playOneShot('nope')).not.toThrow();
    expect(ctx.sources.length).toBe(before);
  });

  test('setScene fades in ambients of the scene and fades out the rest', async () => {
    const ctx = fakeContext();
    const audio = createAudio({ context: () => ctx, fetch: fakeFetch() });
    await audio.load(SAMPLE);
    audio.setScene('dawn');
    expect(audio.layerTarget('birds')).toBeCloseTo(0.6);
    expect(audio.layerTarget('fire')).toBe(0);
    audio.setScene('campfire');
    expect(audio.layerTarget('birds')).toBe(0);
    expect(audio.layerTarget('fire')).toBeCloseTo(0.8);
  });

  test('scheduled oneshot fires once when progress passes its mark', async () => {
    const ctx = fakeContext();
    const audio = createAudio({ context: () => ctx, fetch: fakeFetch() });
    await audio.load(SAMPLE);
    const spy = vi.spyOn(audio, 'playOneShot');
    audio.update({ sceneId: 'dawn', progress: 0.01, dt: 0.1 });
    audio.update({ sceneId: 'dawn', progress: 0.06, dt: 0.1 });
    audio.update({ sceneId: 'dawn', progress: 0.2, dt: 0.1 });
    expect(spy.mock.calls.filter((c) => c[0] === 'conch')).toHaveLength(1);
  });

  test('mute and volume drive the master gain', async () => {
    const ctx = fakeContext();
    const audio = createAudio({ context: () => ctx, fetch: fakeFetch() });
    await audio.load(SAMPLE);
    audio.setVolume(0.5);
    expect(audio.masterTarget()).toBeCloseTo(0.5);
    audio.mute(true);
    expect(audio.masterTarget()).toBe(0);
    audio.mute(false);
    expect(audio.masterTarget()).toBeCloseTo(0.5);
  });

  test('works with no Web Audio support at all', async () => {
    const audio = createAudio({ context: () => null, fetch: fakeFetch() });
    const res = await audio.load(SAMPLE);
    expect(res.loaded).toEqual([]);
    expect(() => audio.update({ sceneId: 'dawn', progress: 0.5, dt: 0.1 })).not.toThrow();
  });
});

describe('manifest', () => {
  test('ids are unique and kinds valid', () => {
    const ids = SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SOUNDS) expect(['ambient', 'oneshot', 'music']).toContain(s.kind);
  });

  test('every sfx file shipped in assets is credited in CREDITS.md', () => {
    const dir = path.resolve('public/assets/audio/sfx');
    const credits = fs.existsSync('public/assets/audio/CREDITS.md') ? fs.readFileSync('public/assets/audio/CREDITS.md', 'utf8') : '';
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
    for (const f of files) expect(credits, f).toContain(f);
  });
});
