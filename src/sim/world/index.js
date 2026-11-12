import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { createLake } from './lake.js';
import { createForest } from './forest.js';

export function buildWorld(scene, renderer) {
  const terrain = createTerrain(scene);
  const sky = createSky(scene, renderer);
  const lake = createLake(scene);
  createForest(scene, terrain.heightAt);
  const focus = new THREE.Vector3();
  return {
    heightAt: terrain.heightAt,
    sky,
    lake,
    update(dt, tod, focusPoint = focus) {
      const s = sky.update(tod, focusPoint);
      lake.update(dt, s.sunDir, s.sunColor);
      return s;
    },
  };
}
