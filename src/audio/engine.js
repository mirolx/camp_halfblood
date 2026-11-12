// Layered Web Audio playback: ambient beds crossfade by scene, oneshots fire on cues or at random
// intervals, positional sounds pan with the camera. Everything degrades to silence on failure.

const BASE = `${import.meta.env?.BASE_URL ?? '/'}assets/audio/`;
const FADE = 1.6; // time constant (s) for setTargetAtTime crossfades

function defaultContext() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AC ? new AC() : null;
}

export function createAudio({ context = defaultContext, fetch: fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
  let ctx = null;
  try { ctx = context(); } catch { ctx = null; }
  const master = ctx?.createGain();
  if (master) {
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  let volume = 0.8;
  let muted = false;

  const defs = new Map(); // id -> def
  const buffers = new Map(); // id -> AudioBuffer
  const layers = new Map(); // id -> { gain, source, panner, target }
  const positions = new Map(); // anchor -> {x,y,z} or () => {x,y,z}
  const fired = new Set();
  const nextAt = new Map();
  let scene = null;
  let clock = 0;
  let musicNow = null;

  const now = () => ctx?.currentTime ?? 0;

  function out(def) {
    // positional sounds route through a panner placed at the def's anchor
    if (!ctx) return null;
    const g = ctx.createGain();
    g.gain.value = 0;
    if (def.position && ctx.createPanner) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 12;
      p.rolloffFactor = 0.8;
      g.connect(p);
      p.connect(master);
      return { gain: g, panner: p };
    }
    g.connect(master);
    return { gain: g, panner: null };
  }

  function placePanner(panner, anchor) {
    if (!panner) return;
    const src = positions.get(anchor);
    const v = typeof src === 'function' ? src() : src;
    if (!v) return;
    const t = now();
    panner.positionX.setTargetAtTime(v.x, t, 0.05);
    panner.positionY.setTargetAtTime(v.y, t, 0.05);
    panner.positionZ.setTargetAtTime(v.z, t, 0.05);
  }

  async function loadOne(def) {
    if (!ctx || !fetchFn) throw new Error('no audio');
    const res = await fetchFn(BASE + def.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.arrayBuffer();
    return ctx.decodeAudioData(data);
  }

  const api = {
    /** Must be called from a user gesture (autoplay policy). */
    async unlock() {
      try { await ctx?.resume(); } catch { /* ignore */ }
    },

    async load(sounds) {
      const loaded = [];
      const failed = [];
      // files shared by several ids (e.g. the conch) are fetched once
      const byFile = new Map();
      await Promise.all(sounds.map(async (def) => {
        defs.set(def.id, def);
        try {
          if (!byFile.has(def.file)) byFile.set(def.file, loadOne(def));
          buffers.set(def.id, await byFile.get(def.file));
          loaded.push(def.id);
        } catch {
          failed.push(def.id);
        }
      }));
      if (failed.length && ctx) console.info(`[audio] not available yet: ${failed.join(', ')}`);
      return { loaded, failed };
    },

    setPosition(anchor, vecOrFn) {
      positions.set(anchor, vecOrFn);
    },

    /** Crossfade ambient beds to the given scene. */
    setScene(sceneId) {
      scene = sceneId;
      fired.clear();
      nextAt.clear();
      for (const [id, def] of defs) {
        if (def.kind !== 'ambient' && !(def.kind === 'music' && def.scenes)) continue;
        if (!buffers.has(id)) continue;
        const on = def.scenes?.includes(sceneId);
        let layer = layers.get(id);
        if (on && !layer) {
          const o = out(def);
          const source = ctx.createBufferSource();
          source.buffer = buffers.get(id);
          source.loop = true;
          source.connect(o.gain);
          source.start(0, Math.random() * Math.max(0, (source.buffer.duration ?? 1) - 0.5));
          layer = { ...o, source, target: 0 };
          layers.set(id, layer);
        }
        if (!layer) continue;
        layer.target = on ? def.volume : 0;
        layer.gain.gain.setTargetAtTime(layer.target, now(), FADE);
      }
    },

    layerTarget(id) {
      return layers.get(id)?.target ?? 0;
    },

    playOneShot(id, { rate = 1 } = {}) {
      const def = defs.get(id);
      const buf = buffers.get(id);
      if (!ctx || !def || !buf) return;
      const o = out(def);
      o.gain.gain.value = def.volume;
      placePanner(o.panner, def.position);
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = rate;
      s.connect(o.gain);
      s.onended = () => { o.gain.disconnect(); o.panner?.disconnect(); };
      s.start();
    },

    /** Non-scene music (quiz, claiming). Pass null to fade out. */
    playMusic(id, { fade = 2 } = {}) {
      if (musicNow) {
        const m = musicNow;
        m.gain.gain.setTargetAtTime(0, now(), fade / 3);
        setTimeout(() => { try { m.source.stop(); } catch { /* already stopped */ } }, fade * 1000 + 200);
        musicNow = null;
      }
      const def = defs.get(id);
      const buf = buffers.get(id);
      if (!ctx || !def || !buf) return;
      const o = out(def);
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      source.connect(o.gain);
      source.start();
      o.gain.gain.setTargetAtTime(def.volume, now(), fade / 3);
      musicNow = { ...o, source };
    },

    /** Called every frame by the director. */
    update({ sceneId, progress, dt = 0, camera }) {
      clock += dt;
      if (sceneId !== scene) api.setScene(sceneId);
      for (const [id, def] of defs) {
        if (def.kind !== 'oneshot' || !def.scenes?.includes(sceneId)) continue;
        if (def.at != null && progress >= def.at && !fired.has(id)) {
          fired.add(id);
          api.playOneShot(id);
        }
        if (def.every) {
          const [a, b] = def.every;
          if (!nextAt.has(id)) nextAt.set(id, clock + a + Math.random() * (b - a));
          if (clock >= nextAt.get(id)) {
            api.playOneShot(id, { rate: 0.92 + Math.random() * 0.16 });
            nextAt.set(id, clock + a + Math.random() * (b - a));
          }
        }
      }
      for (const [id, layer] of layers) placePanner(layer.panner, defs.get(id).position);
      if (camera && ctx?.listener?.positionX) {
        const l = ctx.listener;
        const t = now();
        const p = camera.position;
        l.positionX.setTargetAtTime(p.x, t, 0.05);
        l.positionY.setTargetAtTime(p.y, t, 0.05);
        l.positionZ.setTargetAtTime(p.z, t, 0.05);
        const e = camera.matrixWorld.elements; // -Z forward, +Y up
        l.forwardX.setTargetAtTime(-e[8], t, 0.05);
        l.forwardY.setTargetAtTime(-e[9], t, 0.05);
        l.forwardZ.setTargetAtTime(-e[10], t, 0.05);
        l.upX.setTargetAtTime(e[4], t, 0.05);
        l.upY.setTargetAtTime(e[5], t, 0.05);
        l.upZ.setTargetAtTime(e[6], t, 0.05);
      }
    },

    /** Fade every scene layer out (leaving the sim). */
    stopAll() {
      for (const layer of layers.values()) {
        layer.gain.gain.setTargetAtTime(0, now(), 0.4);
        const s = layer.source;
        setTimeout(() => { try { s.stop(); } catch { /* ignore */ } }, 1500);
      }
      layers.clear();
      scene = null;
    },

    setVolume(v) {
      volume = v;
      if (!muted) master?.gain.setTargetAtTime(v, now(), 0.05);
    },
    mute(m) {
      muted = m;
      master?.gain.setTargetAtTime(m ? 0 : volume, now(), 0.05);
    },
    masterTarget() {
      return muted ? 0 : volume;
    },
  };
  return api;
}
