import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { LAYOUT } from './layout.js';
import { noise2 } from './noise.js';

// Procedural tileable-ish normal map so we need no external texture files.
function makeWaterNormals(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const hgt = (x, y) => {
    const u = (x / size) * 8;
    const v = (y / size) * 8;
    return noise2(u, v) * 0.6 + noise2(u * 2.3 + 5, v * 2.3) * 0.3 + noise2(u * 5, v * 5 + 9) * 0.1;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = hgt((x + 1) % size, y) - hgt((x - 1 + size) % size, y);
      const dy = hgt(x, (y + 1) % size) - hgt(x, (y - 1 + size) % size);
      const n = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createLake(scene) {
  const { x, z, rx, rz, level } = LAYOUT.lake;
  const geo = new THREE.CircleGeometry(1, 64);
  geo.scale(rx + 12, rz + 12, 1);
  const water = new Water(geo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: makeWaterNormals(),
    sunDirection: new THREE.Vector3(0.3, 1, 0.2).normalize(),
    sunColor: 0xffffff,
    waterColor: 0x1d4a55,
    distortionScale: 2.2,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, level, z);
  water.material.uniforms.size.value = 3.5;
  water.name = 'lake';
  scene.add(water);

  return {
    water,
    update(dt, sunDir, sunColor) {
      water.material.uniforms.time.value += dt * 0.6;
      if (sunDir) water.material.uniforms.sunDirection.value.copy(sunDir);
      if (sunColor) water.material.uniforms.sunColor.value.copy(sunColor);
    },
  };
}
