import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { createCrowd } from '../src/sim/actors/campers.js';
import { createPegasi, flightPosition } from '../src/sim/actors/pegasus.js';
import { layoutCabins } from '../src/sim/world/cabins.js';
import { createFacilities } from '../src/sim/world/facilities.js';
import { heightAt } from '../src/sim/world/terrain.js';
import { SCENES } from '../src/sim/timeline.js';
import { LAYOUT, inLake } from '../src/sim/world/layout.js';

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

  test('pegasus watchers stand outside the stables and out of the lake', () => {
    const c = ctx();
    const crowd = createCrowd(c.scene, c, { count: 36 });
    crowd.addMember(new THREE.Group(), { cabinId: 'apollo', role: 'archer', isPlayer: true, index: 0 });
    const S = LAYOUT.stables;
    const rot = Math.atan2(-S.x, -S.z); // the stables face the camp centre
    for (const m of crowd.members) {
      const { pos } = crowd.targetFor(m, 'pegasus', 0.5);
      // into the stables' own frame: 16m x 8m building around the anchor
      const dx = pos.x - S.x;
      const dz = pos.z - S.z;
      const lx = dx * Math.cos(rot) - dz * Math.sin(rot);
      const lz = dx * Math.sin(rot) + dz * Math.cos(rot);
      expect(Math.abs(lx) < 8.6 && Math.abs(lz) < 4.6, `${m.name} inside stables`).toBe(false);
      expect(inLake(pos.x, pos.z), `${m.name} in the lake`).toBeGreaterThan(1.05);
    }
  });

  test('the player never shares a spot with a camper (first person would sit inside their head)', () => {
    const c = ctx();
    const crowd = createCrowd(c.scene, c, { count: 36 });
    const me = crowd.addMember(new THREE.Group(), { cabinId: 'apollo', role: 'archer', isPlayer: true, index: 0 });
    for (const s of SCENES) {
      for (const p of [0.2, 0.6, 0.95]) {
        if (s.id === 'dawn' && p < 0.62) continue; // the director scripts 'me' at the window then
        const mine = crowd.targetFor(me, s.id, p).pos;
        for (const m of crowd.members) {
          if (m === me) continue;
          const d = crowd.targetFor(m, s.id, p).pos.distanceTo(mine);
          expect(d, `${s.id} @${p} vs ${m.name}`).toBeGreaterThan(0.5);
        }
      }
    }
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
