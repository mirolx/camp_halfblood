import * as THREE from 'three';
import { LAYOUT, inLake } from './layout.js';
import { fbm } from './noise.js';

const SIZE = 600;
const SEG = 220;

/** Height in metres at world (x, z). Pure function, shared by everything that sits on the ground. */
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  // rolling base, flattened inside the camp
  const rolling = (fbm(x * 0.012, z * 0.012) - 0.5) * 9;
  const campFlat = THREE.MathUtils.smoothstep(d, 60, 110);
  let y = rolling * campFlat + (fbm(x * 0.05, z * 0.05) - 0.5) * 0.2;

  // distant ridge so the horizon isn't flat
  y += THREE.MathUtils.smoothstep(d, 170, 290) * (18 + fbm(x * 0.01 + 7, z * 0.01) * 30);

  // Half-Blood Hill
  const h = LAYOUT.hill;
  const hd = Math.hypot(x - h.x, z - h.z) / h.radius;
  y += h.height * Math.exp(-hd * hd * 1.6);

  // lake basin
  const l = inLake(x, z, 6);
  if (l < 1.6) {
    const k = THREE.MathUtils.smoothstep(l, 0.55, 1.6);
    y = THREE.MathUtils.lerp(-3.2, y, k);
  }
  return y;
}

const GRASS_A = new THREE.Color('#5d7a35');
const GRASS_B = new THREE.Color('#7e9a45');
const DIRT = new THREE.Color('#9c8460');
const SAND = new THREE.Color('#cdbb8e');
const ROCK = new THREE.Color('#77736a');

export function createTerrain(scene) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    c.copy(GRASS_A).lerp(GRASS_B, fbm(x * 0.04, z * 0.04));
    const lake = inLake(x, z, 6);
    if (lake < 1.25) c.lerp(SAND, THREE.MathUtils.smoothstep(1.25 - lake, 0, 0.35));
    // worn paths around the green
    const d = Math.hypot(x, z);
    if (Math.abs(d - LAYOUT.green.radius - 2) < 2.2) c.lerp(DIRT, 0.55);
    if (y > 16) c.lerp(ROCK, THREE.MathUtils.smoothstep(y, 16, 30));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return { mesh, heightAt };
}
