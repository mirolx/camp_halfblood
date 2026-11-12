import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { createLake } from './lake.js';
import { createForest } from './forest.js';
import { layoutCabins, setCabinNightGlow } from './cabins.js';
import { createFacilities } from './facilities.js';

export function buildWorld(scene, renderer, { interiorFor = 'hermes' } = {}) {
  const terrain = createTerrain(scene);
  const sky = createSky(scene, renderer);
  const lake = createLake(scene);
  createForest(scene, terrain.heightAt);
  const cabins = layoutCabins(scene, terrain.heightAt, { interiorFor });
  const facilities = createFacilities(scene, terrain.heightAt);
  const focus = new THREE.Vector3();
  let t = 0;
  return {
    heightAt: terrain.heightAt,
    sky,
    lake,
    cabins,
    facilities,
    update(dt, tod, focusPoint = focus) {
      t += dt;
      const s = sky.update(tod, focusPoint);
      lake.update(dt, s.sunDir, s.sunColor);
      facilities.campfire.update(t);
      facilities.brazierFire.update(t);
      setCabinNightGlow(cabins, THREE.MathUtils.smoothstep(tod, 0.78, 0.9));
      return s;
    },
  };
}
