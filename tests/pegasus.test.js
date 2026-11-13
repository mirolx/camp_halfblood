import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildPegasus, createPegasi, registerPegasusModel } from '../src/sim/actors/pegasus.js';

beforeAll(async () => {
  const buf = fs.readFileSync(path.resolve(process.cwd(), 'public/assets/models/pegasus_horse.glb'));
  const ab = new ArrayBuffer(buf.length); // jsdom-realm buffer, or the loader reads it as JSON text
  new Uint8Array(ab).set(buf);
  registerPegasusModel(await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej)));
});
afterAll(() => registerPegasusModel(null));

function ctx() {
  const scene = new THREE.Scene();
  return { scene, heightAt: () => 0, anchors: { stables: new THREE.Vector3(0, 0, 0) } };
}

describe('rigged pegasus', () => {
  test('is a skinned horse scaled to roughly the old size, with both wings', () => {
    const p = buildPegasus(0);
    expect(p.userData.rigged).toBe(true);
    expect(p.getObjectByName('wingL')).toBeTruthy();
    expect(p.getObjectByName('wingR')).toBeTruthy();
    const box = new THREE.Box3();
    p.traverse((o) => { if (o.isSkinnedMesh) box.union(new THREE.Box3().setFromObject(o, true)); });
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(2.2);
    expect(size.y).toBeLessThan(3.0);
  });

  test('grounded and flying updates run, and wings stay on the back', () => {
    const c = ctx();
    const peg = createPegasi(c.scene, c, { count: 3 });
    for (let k = 0; k < 60; k++) peg.update(1 / 30, 'training', 0.5);
    for (const p of peg.list) {
      const w = p.getObjectByName('wingL');
      expect(w.position.y).toBeGreaterThan(1.3);
      expect(w.scale.x).toBeLessThan(1.2); // folded
    }
    for (let k = 0; k < 60; k++) peg.update(1 / 30, 'pegasus', 0.5);
    for (const p of peg.list) {
      expect(p.position.y).toBeGreaterThan(3);
      expect(p.getObjectByName('wingL').scale.x).toBeGreaterThan(1.2); // spread
    }
  });
});
