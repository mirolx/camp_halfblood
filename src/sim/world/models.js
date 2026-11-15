import * as THREE from 'three';

// Blender-made cabin models (exported from Higgsfield 3D Jutsu as GLB).
// Each file holds a preview stage (ground, lights, cameras) plus one root node with the cabin.
const BASE = `${import.meta.env?.BASE_URL ?? '/'}assets/models/`;
export const CABIN_MODELS = {
  // `interior` is a second root in the same file, built to fit inside the cabin's walls.
  zeus: { file: 'zeus_cabin.glb', root: 'ZEUS_CABIN', interior: 'ZEUS_INTERIOR' },
  hera: { file: 'hera_cabin.glb', root: 'HERA_CABIN' },
  poseidon: { file: 'poseidon_cabin.glb', root: 'POSEIDON_CABIN', interior: 'POSEIDON_INTERIOR' },
  demeter: { file: 'demeter_cabin.glb', root: 'DEMETER_CABIN' },
  ares: { file: 'ares_cabin.glb', root: 'ARES_CABIN' },
  athena: { file: 'athena_cabin.glb', root: 'ATHENA_CABIN', interior: 'ATHENA_INTERIOR' },
  apollo: { file: 'apollo_cabin.glb', root: 'APOLLO_CABIN' },
  artemis: { file: 'artemis_cabin.glb', root: 'ARTEMIS_CABIN' },
  hephaestus: { file: 'hephaestus_cabin.glb', root: 'HEPHAESTUS_CABIN' },
  aphrodite: { file: 'aphrodite_cabin.glb', root: 'APHRODITE_CABIN', interior: 'APHRODITE_INTERIOR' },
  hermes: { file: 'hermes_cabin.glb', root: 'HERMES_CABIN' },
  dionysus: { file: 'dionysus_cabin.glb', root: 'DIONYSUS_CABIN' },
};

// Camp buildings other than cabins, same pipeline. Keys are what buildWorld's `models` carries.
export const FACILITY_MODELS = {
  bigHouse: { file: 'big_house.glb', root: 'BIG_HOUSE' },
  stables: { file: 'stables.glb', root: 'STABLES' },
  pavilion: { file: 'pavilion.glb', root: 'PAVILION' },
};

/**
 * Pull the cabin root out of a loaded GLB scene and make it game-ready:
 * drop lights, hide placeholder flames (real fire is added at fireSpots), enable shadows.
 */
export function prepareCabinModel(gltfScene, rootName) {
  const root = gltfScene.getObjectByName(rootName);
  if (!root) throw new Error(`Model root not found: ${rootName}`);
  const model = root.clone(true);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  const lights = [];
  const fireSpots = [];
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (o.isLight || o.isCamera) lights.push(o);
    if (!o.isMesh) return;
    if (/_flame$/.test(o.name)) {
      o.visible = false;
      fireSpots.push(o.getWorldPosition(new THREE.Vector3()));
      return;
    }
    o.castShadow = true;
    o.receiveShadow = true;
  });
  for (const l of lights) l.parent?.remove(l);
  model.userData.fireSpots = fireSpots;
  model.userData.anchors = readAnchors(model);
  return model;
}

/**
 * Empties named ANCHOR_<key> mark game spots inside a model (model-local, metres):
 * ANCHOR_window → anchors.window, ANCHOR_path_0..n → anchors.path (in order).
 */
export function readAnchors(model) {
  const anchors = {};
  const path = [];
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  model.traverse((o) => {
    const m = /^ANCHOR_(.+)$/.exec(o.name);
    if (!m) return;
    const p = o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const step = /^path_(\d+)$/.exec(m[1]);
    if (step) path[Number(step[1])] = p;
    else anchors[m[1]] = p;
  });
  if (path.length) anchors.path = path.filter(Boolean);
  return anchors;
}

/** Give metals (gold, bronze) a reflection map so they read as metal, not paint. */
export function applyEnvironment(model, envMap) {
  model.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    m.envMap = envMap;
    m.envMapIntensity = m.metalness > 0.5 ? 1.2 : 0.25;
    m.needsUpdate = true;
  });
}

/** Load every cabin model that exists. Missing or broken files are skipped (procedural cabin is used). */
export async function loadCabinModels() {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const out = {};
  await Promise.all(
    Object.entries({ ...CABIN_MODELS, ...FACILITY_MODELS }).map(async ([id, { file, root, interior }]) => {
      try {
        const gltf = await loader.loadAsync(BASE + file);
        out[id] = prepareCabinModel(gltf.scene, root);
        if (interior) out[id].userData.interior = prepareCabinModel(gltf.scene, interior);
      } catch (err) {
        console.info(`[models] ${id}: using procedural cabin (${err.message})`);
      }
    }),
  );
  return out;
}
