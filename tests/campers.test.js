import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { createCrowd } from '../src/sim/actors/campers.js';
import { createPegasi, flightPosition } from '../src/sim/actors/pegasus.js';
import { layoutCabins } from '../src/sim/world/cabins.js';
import { createFacilities } from '../src/sim/world/facilities.js';
import { heightAt } from '../src/sim/world/terrain.js';
import { SCENES } from '../src/sim/timeline.js';

function ctx() {
  const scene = new THREE.Scene();
  const flat = () => 0;
  return {
    scene,
    heightAt: flat,
    cabins: layoutCabins(scene, flat, {}),
    ...createFacilities(scene, flat),
  };
}

describe('crowd', () => {
  test('dinner targets are inside the pavilion', () => {
    const c = ctx();
    const crowd = createCrowd(c.scene, c, { count: 24 });
    for (const m of crowd.members) {
      const t = crowd.targetFor(m, 'dinner', 0.9);
      expect(t.pos.distanceTo(c.anchors.pavilion), m.name).toBeLessThan(13);
      expect(t.pose).toBe('sit');
    }
  });

  test('campfire targets sit around the campfire', () => {
    const c = ctx();
    const crowd = createCrowd(c.scene, c, { count: 24 });
    for (const m of crowd.members) {
      const t = crowd.targetFor(m, 'campfire', 0.5);
      const d = t.pos.distanceTo(c.anchors.campfire);
      expect(d).toBeGreaterThan(4);
      expect(d).toBeLessThan(14);
    }
  });

  test('training splits campers between archery and arena', () => {
    const c = ctx();
    const crowd = createCrowd(c.scene, c, { count: 24 });
    const poses = crowd.members.map((m) => crowd.targetFor(m, 'training', 0.5).pose);
    expect(poses.filter((p) => p === 'drawBow').length).toBeGreaterThan(4);
    expect(poses.filter((p) => p === 'swing').length).toBeGreaterThan(4);
  });

  test('every scene yields a target for every member', () => {
    const c = ctx();
    const crowd = createCrowd(c.scene, c, { count: 12 });
    for (const s of SCENES) for (const m of crowd.members) {
      const t = crowd.targetFor(m, s.id, 0.3);
      expect(Number.isFinite(t.pos.x) && Number.isFinite(t.pos.z), `${s.id}`).toBe(true);
    }
  });

  test('offering: during early dinner some campers visit the brazier', () => {
    const c = ctx();
    const crowd = createCrowd(c.scene, c, { count: 24 });
    let visits = 0;
    for (let p = 0; p < 0.5; p += 0.01) {
      for (const m of crowd.members) {
        const t = crowd.targetFor(m, 'dinner', p);
        if (t.pos.distanceTo(c.anchors.brazier) < 2.5) visits++;
      }
    }
    expect(visits).toBeGreaterThan(0);
  });
});

describe('pegasus', () => {
  test('flight path stays at least 3m above the real terrain', () => {
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 100; k++) {
        const p = flightPosition(i, k * 1.7);
        expect(p.y - heightAt(p.x, p.z), `peg ${i} t ${k}`).toBeGreaterThan(3);
      }
    }
  });

  test('createPegasi builds the requested number of winged horses', () => {
    const c = ctx();
    const peg = createPegasi(c.scene, c, { count: 4 });
    expect(peg.list).toHaveLength(4);
    for (const p of peg.list) expect(p.getObjectByName('wingL')).toBeTruthy();
  });
});
