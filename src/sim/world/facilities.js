import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { std, box, cyl, sphere, column, wall, gableRoof, textPlane } from './kit.js';
import { createFire } from '../../three/fire.js';

const MARBLE = std('#ece6d8', { rough: 0.35 });
const WOOD = std('#7a5a3c');
const DARK_WOOD = std('#4a3626');
const WHITE = std('#f4f2ec');
const SAND = std('#d8c69a', { rough: 1 });

function place(group, { x, z }, heightAt, rotY = 0) {
  group.position.set(x, heightAt(x, z), z);
  group.rotation.y = rotY;
  return group;
}

function faceCenter(x, z) {
  return Math.atan2(-x, -z);
}

function bigHouse() {
  const g = new THREE.Group();
  const blue = std('#5b88b8', { rough: 0.8 });
  const W = 12, D = 10, F = 3.2;
  for (let f = 0; f < 3; f++) {
    const y = f * F;
    const fr = wall(W, F, 0.3, blue, [{ x: -3.5, w: 1.3, y0: 1, y1: 2.4 }, { x: 0, w: 1.6, y0: f === 0 ? 0 : 1, y1: 2.5 }, { x: 3.5, w: 1.3, y0: 1, y1: 2.4 }], g);
    fr.position.set(0, y, D / 2);
    const bk = wall(W, F, 0.3, blue, [{ x: -3, w: 1.3, y0: 1, y1: 2.4 }, { x: 3, w: 1.3, y0: 1, y1: 2.4 }], g);
    bk.position.set(0, y, -D / 2);
    for (const s of [-1, 1]) {
      const sw = wall(D, F, 0.3, blue, [{ x: 0, w: 1.3, y0: 1, y1: 2.4 }], g);
      sw.rotation.y = Math.PI / 2;
      sw.position.set(s * W / 2, y, 0);
    }
    box(W + 0.5, 0.2, D + 0.5, WHITE, 0, y + F, 0, g); // white trim band
  }
  gableRoof(W, D, 3, std('#4b4f57'), 3 * F, g, 0.7);
  // attic dormer = 4th storey
  box(3, 2, 2, std('#5b88b8'), 0, 3 * F + 1.3, D / 2 - 0.4, g);
  gableRoof(3, 2, 1, std('#4b4f57'), 3 * F + 2.3, g, 0.2).position.z = D / 2 - 0.4;
  // wraparound porch
  box(W + 4, 0.35, D + 4, WOOD, 0, 0.17, 0, g);
  box(W + 4.4, 0.2, D + 4.4, WHITE, 0, F - 0.1, 0, g);
  for (const x of [-7.6, -2.5, 2.5, 7.6]) for (const z of [-6.6, 6.6]) cyl(0.12, 0.12, F - 0.3, WHITE, x, F / 2, z, g, 8);
  // eagle weathervane
  cyl(0.04, 0.04, 2, std('#b8893a', { metal: 0.9, rough: 0.3 }), 0, 3 * F + 4, 0, g, 6);
  const eagle = box(1.2, 0.15, 0.4, std('#b8893a', { metal: 0.9, rough: 0.3 }), 0, 3 * F + 5, 0, g);
  eagle.rotation.y = 0.6;
  return g;
}

function pavilion() {
  const g = new THREE.Group();
  const R = 13;
  const floor = cyl(R, R + 0.3, 0.6, MARBLE, 0, 0.3, 0, g, 40);
  floor.receiveShadow = true;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    column(5.2, 0.32, MARBLE, Math.cos(a) * (R - 0.6), Math.sin(a) * (R - 0.6), g).position.y = 0.6;
  }
  // ring architrave, no roof (canon: open to the sky)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.6, 0.35, 6, 48), MARBLE);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 6.0;
  ring.castShadow = true;
  g.add(ring);
  // tables: one per cabin, radial
  const tables = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const t = new THREE.Group();
    t.position.set(Math.cos(a) * 7.8, 0.6, Math.sin(a) * 7.8);
    t.rotation.y = -a;
    box(3.6, 0.12, 1.1, std('#d9d1bf', { rough: 0.4 }), 0, 0.85, 0, t);
    for (const sz of [-0.95, 0.95]) box(3.4, 0.08, 0.45, WOOD, 0, 0.45, sz, t);
    for (const sx of [-1.5, 1.5]) box(0.12, 0.8, 0.8, WOOD, sx, 0.4, 0, t);
    for (let k = 0; k < 6; k++) cyl(0.14, 0.12, 0.04, WHITE, -1.4 + k * 0.56, 0.93, (k % 2 ? 0.3 : -0.3), t, 10);
    g.add(t);
    tables.push(t);
  }
  // central brazier for offerings
  const brazier = new THREE.Group();
  brazier.position.y = 0.6;
  cyl(0.9, 0.6, 1.0, std('#8a6a2a', { metal: 0.8, rough: 0.35 }), 0, 0.5, 0, brazier, 16);
  const fire = createFire({ scale: 0.7, count: 140 });
  fire.group.position.y = 0.85;
  brazier.add(fire.group);
  g.add(brazier);
  return { group: g, fire, tables, radius: R };
}

function arena() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 40), SAND);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.06;
  floor.receiveShadow = true;
  floor.scale.set(1.3, 1, 1);
  g.add(floor);
  for (let i = 0; i < 3; i++) {
    const r = 16 + i * 1.4;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.2, r + 1.2, 0.6 + i * 0.6, 48, 1, true), std('#8a8070', { rough: 0.95, side: THREE.DoubleSide }));
    tier.scale.set(1.3, 1, 1);
    tier.position.y = (0.6 + i * 0.6) / 2;
    g.add(tier);
  }
  // training dummies
  for (const [x, z] of [[-8, -4], [-8, 4], [8, -4], [8, 4]]) {
    cyl(0.08, 0.08, 1.8, DARK_WOOD, x, 0.9, z, g, 6);
    box(1.2, 0.12, 0.12, DARK_WOOD, x, 1.4, z, g);
    sphere(0.25, std('#c9b48d'), x, 1.9, z, g, 8);
  }
  return g;
}

function archery() {
  const g = new THREE.Group();
  const targets = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Group();
    t.position.set(-10 + i * 4, 0, -22);
    const stand = cyl(0.06, 0.06, 1.6, DARK_WOOD, 0, 0.8, -0.3, t, 6);
    stand.rotation.x = 0.2;
    const colors = ['#f4f0e6', '#2a2a2a', '#2f6fb0', '#c9302c', '#e8c34a'];
    colors.forEach((c, k) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.75 - k * 0.15, 0.75 - k * 0.15, 0.12 + k * 0.01, 24), std(c));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.4;
      ring.castShadow = true;
      t.add(ring);
    });
    g.add(t);
    targets.push(t);
  }
  // shooting line
  box(26, 0.04, 0.2, WHITE, 0, 0.03, 0, g);
  return { group: g, targets };
}

function stables() {
  const g = new THREE.Group();
  const red = std('#8a3a2a');
  const fr = wall(16, 4, 0.3, red, [{ x: -5, w: 2.4, y0: 0, y1: 3 }, { x: 0, w: 2.4, y0: 0, y1: 3 }, { x: 5, w: 2.4, y0: 0, y1: 3 }], g);
  fr.position.z = 4;
  const bk = wall(16, 4, 0.3, red, [], g);
  bk.position.z = -4;
  for (const s of [-1, 1]) {
    const sw = wall(8, 4, 0.3, red, [], g);
    sw.rotation.y = Math.PI / 2;
    sw.position.x = s * 8;
  }
  gableRoof(16, 8, 2.4, std('#5a4636'), 4, g).rotation.y = Math.PI / 2;
  // paddock fence
  for (let i = 0; i < 14; i++) {
    cyl(0.07, 0.07, 1.3, WOOD, -12 + i * 2, 0.65, 14, g, 6);
  }
  box(26, 0.1, 0.1, WOOD, 1, 1.1, 14, g);
  box(26, 0.1, 0.1, WOOD, 1, 0.6, 14, g);
  return g;
}

function amphitheater() {
  const g = new THREE.Group();
  const stone = std('#8d8578', { rough: 0.95 });
  for (let r = 0; r < 5; r++) {
    const radius = 6 + r * 1.3;
    const height = 0.45 * (r + 1);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48, 1, false, Math.PI * 0.6, Math.PI * 0.8), stone);
    step.position.y = height / 2;
    step.receiveShadow = true;
    step.castShadow = true;
    g.add(step);
  }
  const fire = createFire({ scale: 1.6 });
  g.add(fire.group);
  return { group: g, fire };
}

function thaliaPine(heightAt) {
  const g = new THREE.Group();
  const bark = std('#4a3626');
  cyl(0.5, 0.9, 16, bark, 0, 8, 0, g, 10);
  const needles = std('#2c4a2a', { rough: 0.9 });
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(5.5 - i * 0.8, 4.5, 10), needles);
    c.position.y = 7 + i * 2.6;
    c.castShadow = true;
    g.add(c);
  }
  // the Golden Fleece on a low branch
  const branch = cyl(0.12, 0.15, 3, bark, 1.6, 6.2, 0, g, 6);
  branch.rotation.z = -1.1;
  const fleece = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 14, 10),
    std('#e8c34a', { metal: 0.9, rough: 0.35, emissive: '#c9952a', emissiveIntensity: 0.35 }),
  );
  fleece.scale.set(1.2, 0.7, 0.5);
  fleece.position.set(2.8, 5.4, 0);
  g.add(fleece);
  void heightAt;
  return g;
}

function gateArch() {
  const g = new THREE.Group();
  column(6, 0.45, MARBLE, -4, 0, g);
  column(6, 0.45, MARBLE, 4, 0, g);
  box(10, 1.2, 1.2, MARBLE, 0, 6.6, 0, g);
  const sign = textPlane('CAMP HALF-BLOOD', { w: 8.6, h: 0.9, bg: '#ece6d8', color: '#6a5a3a', px: 64 });
  sign.position.set(0, 6.6, 0.61);
  g.add(sign);
  const back = sign.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.61;
  g.add(back);
  return g;
}

function dock() {
  const g = new THREE.Group();
  box(3, 0.25, 22, WOOD, 0, 0.4, -11, g);
  for (let i = 0; i < 6; i++) for (const s of [-1.3, 1.3]) cyl(0.12, 0.12, 2.5, DARK_WOOD, s, -0.6, -2 - i * 4, g, 6);
  // canoes
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 3.4, 4, 10), std(['#b5482e', '#2f6fb0', '#e8c34a', '#3a7a4a'][i]));
    c.rotation.x = Math.PI / 2;
    c.scale.set(1, 1, 0.45);
    c.position.set(i % 2 ? 2.4 : -2.4, -0.1, -5 - i * 4);
    g.add(c);
  }
  return g;
}

function strawberries() {
  const g = new THREE.Group();
  const leaf = std('#3f6a2a');
  const berry = std('#d02a2a', { rough: 0.5 });
  for (let r = 0; r < 10; r++) {
    const row = box(26, 0.4, 0.9, leaf, 0, 0.2, -10 + r * 2.2, g);
    row.castShadow = false;
    for (let k = 0; k < 14; k++) sphere(0.09, berry, -12 + k * 1.8 + (r % 2) * 0.6, 0.45, -10 + r * 2.2 + 0.3, g, 6);
  }
  return g;
}

export function createFacilities(scene, heightAt) {
  const L = LAYOUT;
  const at = (p, y = 0) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + y, p.z);

  const bh = place(bigHouse(), L.bigHouse, heightAt, faceCenter(L.bigHouse.x, L.bigHouse.z));
  const pav = pavilion();
  place(pav.group, L.pavilion, heightAt);
  const ar = place(arena(), L.arena, heightAt);
  const arch = archery();
  place(arch.group, L.archery, heightAt, faceCenter(L.archery.x, L.archery.z) + Math.PI);
  const st = place(stables(), L.stables, heightAt, faceCenter(L.stables.x, L.stables.z));
  const amph = amphitheater();
  place(amph.group, L.amphitheater, heightAt, faceCenter(L.amphitheater.x, L.amphitheater.z));
  const pine = place(thaliaPine(heightAt), L.thaliaPine, heightAt);
  const gate = place(gateArch(), { x: L.thaliaPine.x + 12, z: L.thaliaPine.z - 16 }, heightAt, Math.PI);
  const dk = place(dock(), L.dock, heightAt, Math.atan2(L.lake.x - L.dock.x, L.lake.z - L.dock.z) + Math.PI);
  const sb = place(strawberries(), L.strawberries, heightAt, 0.3);
  scene.add(bh, pav.group, ar, arch.group, st, amph.group, pine, gate, dk, sb);

  arch.group.updateMatrixWorld(true);
  pav.group.updateMatrixWorld(true);
  const targetWorld = arch.targets.map((t) => t.getWorldPosition(new THREE.Vector3()));

  const anchors = {
    green: new THREE.Vector3(0, heightAt(0, 0), 0),
    bigHouse: at(L.bigHouse),
    pavilion: at(L.pavilion, 0.6),
    brazier: at(L.pavilion, 0.6),
    arena: at(L.arena),
    archery: at(L.archery),
    stables: at(L.stables),
    amphitheater: at(L.amphitheater),
    campfire: at(L.amphitheater),
    dock: at(L.dock),
    thaliaPine: at(L.thaliaPine),
    lake: new THREE.Vector3(L.lake.x, L.lake.level, L.lake.z),
  };

  return {
    anchors,
    archeryTargets: targetWorld,
    pavilionTables: pav.tables,
    brazierFire: pav.fire,
    campfire: amph.fire,
    gate,
  };
}
