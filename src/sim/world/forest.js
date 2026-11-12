import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAYOUT, inLake } from './layout.js';
import { rng, fbm } from './noise.js';

function pineGeometry() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const r = 2.6 - i * 0.55;
    const g = new THREE.ConeGeometry(r, 3.2, 8);
    g.translate(0, 3 + i * 1.9, 0);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

function broadleafGeometry() {
  const parts = [];
  const blobs = [[0, 6.2, 0, 3], [1.6, 5.4, 0.6, 2.2], [-1.4, 5.6, -0.4, 2.3], [0.2, 7.6, 0.3, 2.1]];
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(x, y, z);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

function trunkGeometry(h) {
  const g = new THREE.CylinderGeometry(0.25, 0.4, h, 6);
  g.translate(0, h / 2, 0);
  return g;
}

function isClear(x, z) {
  const { lake, campRadius } = LAYOUT;
  if (inLake(x, z, 8) < 1) return false;
  if (Math.hypot(x, z) < campRadius) return false;
  if (Math.hypot(x - LAYOUT.hill.x, z - LAYOUT.hill.z) < 22) return false; // keep the hill crest open
  if (Math.hypot(x - lake.x, z - lake.z) > 260 && Math.abs(x) > 280) return false;
  return true;
}

/** Instanced pines + broadleaf trees around the camp. */
export function createForest(scene, heightAt, { count = 1100, seed = 7 } = {}) {
  const rand = rng(seed);
  const pines = [];
  const leafs = [];
  let tries = 0;
  while (pines.length + leafs.length < count && tries < count * 20) {
    tries++;
    const x = (rand() - 0.5) * 560;
    const z = (rand() - 0.5) * 560;
    if (!isClear(x, z)) continue;
    // clumpy density
    if (fbm(x * 0.02, z * 0.02) < 0.42 && rand() < 0.6) continue;
    const s = 0.75 + rand() * 0.7;
    const item = { x, z, y: heightAt(x, z) - 0.2, s, r: rand() * Math.PI * 2 };
    (rand() < 0.62 ? pines : leafs).push(item);
  }
  // a few shade trees inside camp, away from buildings
  for (const [x, z] of [[-14, -40], [24, -14], [-70, 30], [70, 10], [-20, 70], [28, 64], [-62, -14]]) {
    leafs.push({ x, z, y: heightAt(x, z) - 0.2, s: 0.9, r: x });
  }

  const pineMat = new THREE.MeshStandardMaterial({ color: '#2f4a2a', roughness: 0.9, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4c6b2c', roughness: 0.9, flatShading: true });
  const barkMat = new THREE.MeshStandardMaterial({ color: '#4a3626', roughness: 1 });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();

  function instanced(geo, mat, items, tint) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.r);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * (0.9 + (i % 5) * 0.05), it.s));
      mesh.setMatrixAt(i, m);
      if (tint) {
        color.set(tint).offsetHSL((((i * 7) % 11) - 5) * 0.006, 0, (((i * 3) % 9) - 4) * 0.02);
        mesh.setColorAt(i, color);
      }
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  instanced(pineGeometry(), pineMat, pines, '#ffffff');
  instanced(trunkGeometry(3.2), barkMat, pines);
  instanced(broadleafGeometry(), leafMat, leafs, '#ffffff');
  instanced(trunkGeometry(5), barkMat, leafs);

  return { count: pines.length + leafs.length };
}
