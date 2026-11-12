import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { createCameras } from '../src/sim/cameras.js';
import { createPlayer } from '../src/three/player.js';
import { layoutCabins } from '../src/sim/world/cabins.js';
import { createFacilities } from '../src/sim/world/facilities.js';

function setup() {
  const scene = new THREE.Scene();
  const flat = () => 0;
  const player = createPlayer('female');
  player.position.set(5, 0, 5);
  scene.add(player);
  const ctx = { heightAt: flat, cabins: layoutCabins(scene, flat, { interiorFor: 'ares' }), homeCabin: 'ares', player, ...createFacilities(scene, flat) };
  const cams = createCameras({ domElement: document.createElement('canvas') }, ctx);
  return { cams, player };
}

describe('cameras', () => {
  test('switching to first person cuts straight to the eyes (no glide through the scene)', () => {
    const { cams, player } = setup();
    cams.snap('training', 0.2);
    cams.update(0.016, 'training', 0.2);
    cams.setMode('first');
    cams.update(0.016, 'training', 0.2);
    const head = new THREE.Vector3();
    player.userData.head.getWorldPosition(head);
    expect(cams.camera.position.distanceTo(head)).toBeLessThan(0.3);
  });

  test('first person hides my own body and overview shows it again', () => {
    const { cams, player } = setup();
    cams.setMode('first');
    expect(player.visible).toBe(false);
    cams.setMode('overview');
    expect(player.visible).toBe(true);
  });

  test('dawn path from window to door never jumps more than 0.5m between frames', () => {
    const { cams } = setup();
    let prev = null;
    let maxStep = 0;
    for (let p = 0; p <= 0.62; p += 0.002) {
      cams.snap('dawn', p);
      const pos = cams.camera.position.clone();
      if (prev) maxStep = Math.max(maxStep, pos.distanceTo(prev));
      prev = pos;
    }
    expect(maxStep).toBeLessThan(0.5);
  });

  test('dawn look direction never flips between frames', () => {
    const { cams } = setup();
    let prev = null;
    let maxTurn = 0;
    for (let p = 0.3; p <= 0.62; p += 0.002) {
      cams.snap('dawn', p);
      const dir = new THREE.Vector3();
      cams.camera.getWorldDirection(dir);
      if (prev) maxTurn = Math.max(maxTurn, dir.angleTo(prev));
      prev = dir;
    }
    expect(maxTurn).toBeLessThan(0.2);
  });
});
