import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { buildCabin, layoutCabins } from '../src/sim/world/cabins.js';
import { prepareCabinModel } from '../src/sim/world/models.js';

const flat = () => 0;

// stand-in for a loaded GLB scene: root node + preview junk the loader must strip
function fakeGltfScene() {
  const scene = new THREE.Group();
  const root = new THREE.Group();
  root.name = 'ZEUS_CABIN';
  const marble = new THREE.Mesh(new THREE.BoxGeometry(9.6, 6, 13), new THREE.MeshStandardMaterial({ name: 'MAT_marble' }));
  marble.position.y = 3;
  const gold = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'MAT_gold', metalness: 1 }));
  gold.position.y = 3;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5), new THREE.MeshStandardMaterial({ name: 'MAT_fire' }));
  flame.name = 'BRAZIER_1_flame';
  root.add(marble, gold, flame);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial());
  ground.name = 'PREVIEW_ground';
  scene.add(root, ground, new THREE.DirectionalLight());
  return scene;
}

describe('prepareCabinModel', () => {
  test('keeps only the cabin root, drops preview ground and lights', () => {
    const m = prepareCabinModel(fakeGltfScene(), 'ZEUS_CABIN');
    expect(m.getObjectByName('PREVIEW_ground')).toBeFalsy();
    let lights = 0;
    m.traverse((o) => { if (o.isLight) lights++; });
    expect(lights).toBe(0);
  });

  test('hides placeholder flames and reports where real fire should go', () => {
    const m = prepareCabinModel(fakeGltfScene(), 'ZEUS_CABIN');
    expect(m.getObjectByName('BRAZIER_1_flame').visible).toBe(false);
    expect(m.userData.fireSpots).toHaveLength(1);
  });

  test('meshes cast and receive shadows', () => {
    const m = prepareCabinModel(fakeGltfScene(), 'ZEUS_CABIN');
    m.traverse((o) => { if (o.isMesh && o.visible) expect(o.castShadow && o.receiveShadow).toBe(true); });
  });
});

describe('cabins with a Blender model', () => {
  test('zeus uses the model instead of procedural walls but keeps footprint and anchors', () => {
    const model = prepareCabinModel(fakeGltfScene(), 'ZEUS_CABIN');
    const plain = buildCabin('zeus');
    const withModel = buildCabin('zeus', { model });
    expect(withModel.getObjectByName('model-zeus')).toBeTruthy();
    expect(withModel.getObjectByName('footprint')).toBeTruthy();
    expect(withModel.getObjectByName('plate')).toBeFalsy();
    for (const k of Object.keys(plain.userData.anchors)) {
      expect(withModel.userData.anchors[k].equals(plain.userData.anchors[k]), k).toBe(true);
    }
  });

  test('the home cabin keeps the procedural build (it needs the interior and big window)', () => {
    const model = prepareCabinModel(fakeGltfScene(), 'ZEUS_CABIN');
    const map = layoutCabins(new THREE.Scene(), flat, { interiorFor: 'zeus', models: { zeus: model } });
    expect(map.get('zeus').getObjectByName('model-zeus')).toBeFalsy();
    expect(map.get('zeus').getObjectByName('interior')).toBeTruthy();
  });

  test('a model with a fitted interior is used for the home cabin, with its anchors and doors', () => {
    const scene = fakeGltfScene();
    const ext = scene.getObjectByName('ZEUS_CABIN');
    for (const nm of ['DOOR_pivot_L', 'DOOR_pivot_R']) ext.add(Object.assign(new THREE.Group(), { name: nm }));
    const inner = new THREE.Group();
    inner.name = 'ZEUS_INTERIOR';
    const mk = (name, x, y, z) => Object.assign(new THREE.Group(), { name }).translateX(x).translateY(y).translateZ(z);
    inner.add(mk('ANCHOR_window', 2.3, 2.3, -4.6), mk('ANCHOR_path_1', 1, 2.2, -2), mk('ANCHOR_path_0', 2.3, 2.3, -4.6), mk('ANCHOR_lamp', 0, 4.2, -1.6));
    scene.add(inner);
    const model = prepareCabinModel(scene, 'ZEUS_CABIN');
    model.userData.interior = prepareCabinModel(scene, 'ZEUS_INTERIOR');

    const map = layoutCabins(new THREE.Scene(), flat, { interiorFor: 'zeus', models: { zeus: model } });
    const cab = map.get('zeus');
    expect(cab.getObjectByName('model-zeus')).toBeTruthy();
    expect(cab.getObjectByName('interior').getObjectByName('interior-model-zeus')).toBeTruthy();
    expect(cab.getObjectByName('interior').children.some((c) => c.isPointLight)).toBe(true);
    // anchors are converted from metres into the (scaled) cabin group
    const k = 1.15;
    expect(cab.userData.anchors.window.x).toBeCloseTo(2.3 / k, 5);
    expect(cab.userData.dawnPath.map((v) => v.x)).toEqual([2.3 / k, 1 / k]);
    expect(cab.userData.doors.map((d) => d.sign)).toEqual([1, -1]);
  });

  test('model is placed at real-world size regardless of the cabin group scale', () => {
    const model = prepareCabinModel(fakeGltfScene(), 'ZEUS_CABIN');
    const map = layoutCabins(new THREE.Scene(), flat, { interiorFor: 'hermes', models: { zeus: model } });
    const m = map.get('zeus').getObjectByName('model-zeus');
    m.updateWorldMatrix(true, true);
    const ws = m.getWorldScale(new THREE.Vector3());
    expect(ws.x).toBeCloseTo(1, 5);
    expect(ws.y).toBeCloseTo(1, 5);
  });
});

describe('cabin model registry', () => {
  test('hephaestus cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.hephaestus).toEqual({ file: 'hephaestus_cabin.glb', root: 'HEPHAESTUS_CABIN' });
  });

  test('poseidon cabin is registered with its Blender root and fitted interior', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.poseidon).toEqual({ file: 'poseidon_cabin.glb', root: 'POSEIDON_CABIN', interior: 'POSEIDON_INTERIOR' });
  });

  test('demeter cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.demeter).toEqual({ file: 'demeter_cabin.glb', root: 'DEMETER_CABIN' });
  });

  test('ares cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.ares).toEqual({ file: 'ares_cabin.glb', root: 'ARES_CABIN' });
  });

  test('aphrodite cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.aphrodite).toEqual({ file: 'aphrodite_cabin.glb', root: 'APHRODITE_CABIN' });
  });

  test('athena cabin is registered with its Blender root and fitted interior', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.athena).toEqual({ file: 'athena_cabin.glb', root: 'ATHENA_CABIN', interior: 'ATHENA_INTERIOR' });
  });

  test('apollo cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.apollo).toEqual({ file: 'apollo_cabin.glb', root: 'APOLLO_CABIN' });
  });

  test('artemis cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.artemis).toEqual({ file: 'artemis_cabin.glb', root: 'ARTEMIS_CABIN' });
  });

  test('hermes cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.hermes).toEqual({ file: 'hermes_cabin.glb', root: 'HERMES_CABIN' });
  });

  test('dionysus cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.dionysus).toEqual({ file: 'dionysus_cabin.glb', root: 'DIONYSUS_CABIN' });
  });

  test('hera cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.hera).toEqual({ file: 'hera_cabin.glb', root: 'HERA_CABIN' });
  });

  test('every cabin now has a Blender model', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    const { CABIN_IDS } = await import('../src/sim/world/cabins.js');
    expect(Object.keys(CABIN_MODELS).sort()).toEqual([...CABIN_IDS].sort());
  });

  test('hephaestus uses the model and keeps its anchors', () => {
    const scene = new THREE.Group();
    const root = new THREE.Group();
    root.name = 'HEPHAESTUS_CABIN';
    const forgeFlame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5), new THREE.MeshStandardMaterial());
    forgeFlame.name = 'FORGE_flame';
    root.add(new THREE.Mesh(new THREE.BoxGeometry(9, 6, 13), new THREE.MeshStandardMaterial()), forgeFlame);
    scene.add(root);
    const model = prepareCabinModel(scene, 'HEPHAESTUS_CABIN');
    expect(model.userData.fireSpots).toHaveLength(1);
    const plain = buildCabin('hephaestus');
    const withModel = buildCabin('hephaestus', { model });
    expect(withModel.getObjectByName('model-hephaestus')).toBeTruthy();
    for (const k of Object.keys(plain.userData.anchors)) {
      expect(withModel.userData.anchors[k].equals(plain.userData.anchors[k]), k).toBe(true);
    }
  });
});

describe('Big House model', () => {
  test('is registered as a facility model with its Blender root', async () => {
    const { FACILITY_MODELS } = await import('../src/sim/world/models.js');
    expect(FACILITY_MODELS.bigHouse).toEqual({ file: 'big_house.glb', root: 'BIG_HOUSE' });
  });

  test('stables are registered as a facility model with their Blender root', async () => {
    const { FACILITY_MODELS } = await import('../src/sim/world/models.js');
    expect(FACILITY_MODELS.stables).toEqual({ file: 'stables.glb', root: 'STABLES' });
  });

  test('the pavilion is registered as a facility model with its Blender root', async () => {
    const { FACILITY_MODELS } = await import('../src/sim/world/models.js');
    expect(FACILITY_MODELS.pavilion).toEqual({ file: 'pavilion.glb', root: 'PAVILION' });
  });

  test('with a pavilion model the table frames stay (empty) for seating, and the offering fire stays', async () => {
    const THREE = await import('three');
    const { createFacilities } = await import('../src/sim/world/facilities.js');
    const model = new THREE.Group();
    model.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()), { name: 'TABLE_00' }));
    const plain = createFacilities(new THREE.Scene(), () => 0);
    const f = createFacilities(new THREE.Scene(), () => 0, { models: { pavilion: model } });
    expect(f.pavilion.getObjectByName('TABLE_00')).toBeTruthy();
    expect(f.pavilionTables).toHaveLength(12);
    f.pavilionTables.forEach((t, i) => {
      expect(t.children).toHaveLength(0);
      expect(t.position.equals(plain.pavilionTables[i].position)).toBe(true);
      expect(t.rotation.y).toBe(plain.pavilionTables[i].rotation.y);
    });
    expect(f.brazierFire).toBeTruthy();
    expect(f.modelled).toHaveLength(1);
    expect(plain.modelled).toHaveLength(0);
  });

  test('facilities place a copy of the loaded stables model', async () => {
    const THREE = await import('three');
    const { createFacilities } = await import('../src/sim/world/facilities.js');
    const model = new THREE.Group();
    model.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()), { name: 'PADDOCK_fence' }));
    const f = createFacilities(new THREE.Scene(), () => 0, { models: { stables: model } });
    expect(f.stables.getObjectByName('PADDOCK_fence')).toBeTruthy();
    expect(f.stables).not.toBe(model);
  });

  test('facilities place a copy of the loaded model, or fall back to the procedural house', async () => {
    const THREE = await import('three');
    const { createFacilities } = await import('../src/sim/world/facilities.js');
    const model = new THREE.Group();
    model.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()), { name: 'BODY_walls' }));
    const flat = () => 0;
    const withModel = createFacilities(new THREE.Scene(), flat, { models: { bigHouse: model } });
    expect(withModel.bigHouse.getObjectByName('BODY_walls')).toBeTruthy();
    expect(withModel.bigHouse).not.toBe(model); // a fresh copy per world, so rebuilding the sim keeps the original
    const plain = createFacilities(new THREE.Scene(), flat);
    expect(plain.bigHouse.getObjectByName('BODY_walls')).toBeFalsy();
    expect(plain.bigHouse.children.length).toBeGreaterThan(0);
  });
});
