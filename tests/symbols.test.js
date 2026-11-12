import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { GOD_IDS } from '../src/quiz/gods.js';
import { createSymbol } from '../src/three/symbols.js';
import { createPlayer } from '../src/three/player.js';

describe('createSymbol', () => {
  test('returns a non-empty Object3D for every god', () => {
    for (const id of GOD_IDS) {
      const s = createSymbol(id);
      expect(s, id).toBeInstanceOf(THREE.Object3D);
      let meshes = 0;
      s.traverse((o) => { if (o.isMesh) meshes++; });
      expect(meshes, id).toBeGreaterThan(0);
    }
  });

  test('throws for hera', () => {
    expect(() => createSymbol('hera')).toThrow();
  });
});

describe('createPlayer', () => {
  test('is about 1.7m tall', () => {
    for (const g of ['male', 'female']) {
      const p = createPlayer(g);
      const size = new THREE.Box3().setFromObject(p).getSize(new THREE.Vector3());
      expect(size.y, g).toBeGreaterThan(1.55);
      expect(size.y, g).toBeLessThan(1.85);
    }
  });

  test('male and female differ in hair and shoulders', () => {
    const m = createPlayer('male');
    const f = createPlayer('female');
    const hairBox = (p) => new THREE.Box3().setFromObject(p.getObjectByName('hair')).getSize(new THREE.Vector3());
    expect(hairBox(f).y).toBeGreaterThan(hairBox(m).y + 0.1); // ponytail hangs down
    expect(m.getObjectByName('torso').scale.x).toBeGreaterThan(f.getObjectByName('torso').scale.x);
  });

  test('setPose accepts known poses and rejects unknown', () => {
    const p = createPlayer('female');
    for (const pose of ['idle', 'walk', 'sit', 'drawBow', 'swing']) expect(() => p.userData.setPose(pose)).not.toThrow();
    expect(() => p.userData.setPose('dance')).toThrow();
  });
});
