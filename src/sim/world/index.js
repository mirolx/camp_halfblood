import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { createLake } from './lake.js';
import { createForest } from './forest.js';
import { layoutCabins, setCabinNightGlow } from './cabins.js';
import { createFacilities } from './facilities.js';
import { applyEnvironment } from './models.js';
import { createFire } from '../../three/fire.js';

export function buildWorld(scene, renderer, { interiorFor = 'hermes', models = {} } = {}) {
  const terrain = createTerrain(scene);
  const sky = createSky(scene, renderer);
  const lake = createLake(scene);
  createForest(scene, terrain.heightAt);
  const cabins = layoutCabins(scene, terrain.heightAt, { interiorFor, models });
  const facilities = createFacilities(scene, terrain.heightAt, { models });

  // Blender cabins: reflections for gold/bronze, and real fire in the braziers
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const metals = []; // every model material with its daytime reflection strength
  const fires = [];
  const modelled = [...cabins.values()].map((c) => c.getObjectByName(`model-${c.userData.id}`));
  for (const k of ['bigHouse', 'stables']) if (models[k]) modelled.push(facilities[k]);
  for (const model of modelled) {
    if (!model) continue;
    applyEnvironment(model, env);
    model.traverse((o) => {
      if (o.isMesh && o.material && !metals.some((e) => e.m === o.material)) metals.push({ m: o.material, base: o.material.envMapIntensity });
    });
    for (const spot of model.userData.fireSpots ?? []) {
      const fire = createFire({ scale: 0.38, count: 80 });
      fire.group.position.copy(spot).add(new THREE.Vector3(0, -0.06, 0));
      fire.light.intensity = 0;
      fire.light.distance = 6;
      fire.light.castShadow = false;
      model.add(fire.group);
      fires.push(fire);
    }
  }

  const focus = new THREE.Vector3();
  let t = 0;
  return {
    heightAt: terrain.heightAt,
    /**
     * Soft all-round fill for characters. With only the sun and a dim hemisphere light, their
     * camera-facing side is usually in shade (the scripted shots often look into the sun) and
     * renders near-black. The same studio map as the cabins lifts that side and fades out at night.
     */
    addFill(root, strength = 0.9) {
      root.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m?.isMeshStandardMaterial || metals.some((e) => e.m === m)) continue;
          m.envMap = env;
          m.envMapIntensity = strength;
          m.needsUpdate = true;
          metals.push({ m, base: strength });
        }
      });
    },
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
      const night = THREE.MathUtils.smoothstep(tod, 0.78, 0.9);
      setCabinNightGlow(cabins, night);
      // the studio reflection map is daylight-bright; dim it with the sun so gold doesn't glow at night
      const daylight = 1 - THREE.MathUtils.smoothstep(tod, 0.72, 0.86);
      for (const e of metals) e.m.envMapIntensity = e.base * (0.12 + daylight * 0.88);
      for (const f of fires) {
        f.update(t);
        f.light.intensity *= 0.08 + night * 0.25;
      }
      return s;
    },
  };
}
