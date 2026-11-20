import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHARACTER_MODELS, clearCharacterModels, registerCharacterModel } from '../src/three/characters.js';
import { createPlayer } from '../src/three/player.js';

const DIR = path.resolve(process.cwd(), 'public/assets/models/campers');

// load the real GLBs straight from disk (the browser loader fetches them from /assets)
beforeAll(async () => {
  const loader = new GLTFLoader();
  for (const [gender, specs] of Object.entries(CHARACTER_MODELS)) {
    for (const spec of specs) {
      const buf = fs.readFileSync(path.join(DIR, spec.file));
      // copy into this realm's ArrayBuffer (jsdom's) or the loader takes it for JSON text
      const ab = new ArrayBuffer(buf.length);
      new Uint8Array(ab).set(buf);
      const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
      registerCharacterModel(gender, spec, gltf);
    }
  }
});
afterAll(() => clearCharacterModels());

// body only: the hidden bow and sword would stretch the box
const height = (p) => {
  const box = new THREE.Box3();
  p.traverse((o) => { if (o.isSkinnedMesh) box.union(new THREE.Box3().setFromObject(o, true)); });
  return box.getSize(new THREE.Vector3()).y;
};

describe('rigged campers', () => {
  test('every model file exists and has the clips the poses use', async () => {
    for (const g of ['male', 'female']) {
      for (let s = 0; s < CHARACTER_MODELS[g].length; s++) {
        const p = createPlayer(g, { seed: s * 2 });
        expect(p.userData.rigged, `${g} ${s}`).toBe(true);
        expect(p.userData.head?.isBone).toBe(true);
      }
    }
  });

  test('standing campers are about 1.8m tall', () => {
    for (const g of ['male', 'female']) {
      const p = createPlayer(g, { seed: 3 });
      p.updateMatrixWorld(true);
      expect(height(p), g).toBeGreaterThan(1.6);
      expect(height(p), g).toBeLessThan(1.95);
    }
  });

  test('a crowd of alternating genders still gets every outfit', () => {
    const files = new Set();
    for (let i = 0; i < 12; i++) {
      const p = createPlayer(i % 2 ? 'male' : 'female', { seed: i + 5 });
      let mesh = null;
      p.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
      files.add(`${p.userData.gender}:${mesh.geometry.uuid}`);
    }
    expect(files.size).toBe(CHARACTER_MODELS.male.length + CHARACTER_MODELS.female.length);
  });

  test('shirts are camp orange', () => {
    const orange = new THREE.Color('#f28c28');
    const p = createPlayer('male', { seed: 0 });
    const shirts = [];
    p.traverse((o) => { if (o.isMesh && CHARACTER_MODELS.male[0].shirt.includes(o.material.name)) shirts.push(o.material); });
    expect(shirts.length).toBeGreaterThan(0);
    for (const m of shirts) expect(m.color.equals(orange)).toBe(true);
  });

  test('every pose runs, unknown poses throw, and sitting lowers the body', () => {
    const p = createPlayer('female', { seed: 1 });
    for (const pose of ['idle', 'walk', 'sit', 'drawBow', 'swing']) {
      p.userData.setPose(pose);
      for (let k = 0; k < 30; k++) p.userData.update(1 / 30, pose === 'walk' ? 1.6 : 1);
    }
    expect(() => p.userData.setPose('dance')).toThrow();

    const head = new THREE.Vector3();
    p.userData.setPose('idle');
    p.userData.update(0.5);
    p.updateMatrixWorld(true);
    const standing = p.userData.head.getWorldPosition(head).y;
    p.userData.setPose('sit');
    p.userData.update(0.5);
    p.updateMatrixWorld(true);
    expect(p.userData.head.getWorldPosition(head).y).toBeLessThan(standing - 0.3);
  });

  test('pose turns do not pile up over many frames', () => {
    // a held pose built from bone turns (drawBow now animates a shot cycle, so it moves on purpose)
    const p = createPlayer('male', { seed: 2 });
    p.userData.setPose('ride');
    const wrist = () => {
      p.updateMatrixWorld(true);
      return p.getObjectByName('WristL').getWorldPosition(new THREE.Vector3());
    };
    p.userData.update(1 / 60);
    const a = wrist();
    for (let k = 0; k < 600; k++) p.userData.update(1 / 60);
    expect(wrist().distanceTo(a)).toBeLessThan(0.15);
  });
});
