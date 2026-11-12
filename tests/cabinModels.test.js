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

  test('poseidon cabin is registered with its Blender root', async () => {
    const { CABIN_MODELS } = await import('../src/sim/world/models.js');
    expect(CABIN_MODELS.poseidon).toEqual({ file: 'poseidon_cabin.glb', root: 'POSEIDON_CABIN' });
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
