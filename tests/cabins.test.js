import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { CABIN_IDS, buildCabin, layoutCabins } from '../src/sim/world/cabins.js';
import { createFacilities } from '../src/sim/world/facilities.js';

const flat = () => 0;

describe('cabins', () => {
  test('CABIN_IDS lists 12 cabins in canon order', () => {
    expect(CABIN_IDS).toEqual(['zeus', 'hera', 'poseidon', 'demeter', 'ares', 'athena', 'apollo', 'artemis', 'hephaestus', 'aphrodite', 'hermes', 'dionysus']);
  });

  test('buildCabin works for all 12 ids and exposes anchors', () => {
    for (const id of CABIN_IDS) {
      const c = buildCabin(id, { interior: false });
      expect(c, id).toBeInstanceOf(THREE.Group);
      for (const k of ['door', 'window', 'bed', 'sound']) expect(c.userData.anchors[k], `${id}.${k}`).toBeInstanceOf(THREE.Vector3);
    }
  });

  test('interior:true adds a child named interior, false does not', () => {
    expect(buildCabin('athena', { interior: true }).getObjectByName('interior')).toBeTruthy();
    expect(buildCabin('athena', { interior: false }).getObjectByName('interior')).toBeFalsy();
  });

  test('cabin footprints in layoutCabins do not overlap (oriented rectangles)', () => {
    const scene = new THREE.Scene();
    const map = layoutCabins(scene, flat, { interiorFor: 'poseidon' });
    expect(map.size).toBe(12);
    // footprint corners in world XZ
    const rects = [...map.values()].map((g) => {
      g.updateMatrixWorld(true);
      const fp = g.getObjectByName('footprint');
      fp.geometry.computeBoundingBox();
      const { min, max } = fp.geometry.boundingBox;
      return [[min.x, min.z], [max.x, min.z], [max.x, max.z], [min.x, max.z]].map(([x, z]) => {
        const v = new THREE.Vector3(x, 0, z).applyMatrix4(fp.matrixWorld);
        return [v.x, v.z];
      });
    });
    const axes = (r) => [0, 1].map((i) => {
      const [a, b] = [r[i], r[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    });
    const overlap = (A, B) => [...axes(A), ...axes(B)].every(([ax, az]) => {
      const pa = A.map(([x, z]) => x * ax + z * az);
      const pb = B.map(([x, z]) => x * ax + z * az);
      return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
    });
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      expect(overlap(rects[i], rects[j]), CABIN_IDS[i] + " vs " + CABIN_IDS[j]).toBe(false);
    }
  });

  test('world anchors are world-space (door of placed cabin is far from origin)', () => {
    const scene = new THREE.Scene();
    const map = layoutCabins(scene, flat, { interiorFor: 'zeus' });
    const door = map.get('zeus').userData.worldAnchors.door;
    expect(Math.hypot(door.x, door.z)).toBeGreaterThan(15);
  });
});

describe('facilities', () => {
  test('anchors are all defined', () => {
    const f = createFacilities(new THREE.Scene(), flat);
    for (const k of ['archery', 'arena', 'stables', 'pavilion', 'brazier', 'amphitheater', 'campfire', 'bigHouse', 'dock', 'thaliaPine', 'green']) {
      expect(f.anchors[k], k).toBeInstanceOf(THREE.Vector3);
    }
  });
});
