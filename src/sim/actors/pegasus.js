import * as THREE from 'three';
import { LAYOUT } from '../world/layout.js';
import { heightAt } from '../world/terrain.js';

const COAT = new THREE.MeshStandardMaterial({ color: '#f3f0ea', roughness: 0.6 });
const MANE = new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.8 });
const HOOF = new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.7 });
const FEATHER = new THREE.MeshStandardMaterial({ color: '#fbf9f4', roughness: 0.7, side: THREE.DoubleSide });

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.castShadow = true;
  return m;
}

/** Layered feather wing: a fan of tapered feathers on a pivot at the shoulder. */
function wing(side) {
  const pivot = new THREE.Group();
  pivot.name = side > 0 ? 'wingR' : 'wingL';
  const rows = [
    { n: 9, len: 1.9, w: 0.26, y: 0 },
    { n: 7, len: 1.25, w: 0.3, y: 0.03 },
    { n: 5, len: 0.7, w: 0.32, y: 0.06 },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const t = i / (row.n - 1);
      const shape = new THREE.Shape();
      shape.moveTo(0, -row.w / 2);
      shape.quadraticCurveTo(row.len * 0.7, -row.w * 0.55, row.len, 0);
      shape.quadraticCurveTo(row.len * 0.7, row.w * 0.55, 0, row.w / 2);
      const f = new THREE.Mesh(new THREE.ShapeGeometry(shape), FEATHER);
      f.rotation.x = -Math.PI / 2;
      // feathers fan from pointing outward (t=0) to pointing back (t=1)
      const holder = new THREE.Group();
      holder.rotation.y = -side * 0 + (side > 0 ? 0 : Math.PI) + side * -(0.05 + t * 1.15);
      holder.position.set(side * (0.1 + t * 0.55 * (row.len / 1.9)), row.y, t * 0.35);
      f.castShadow = true;
      holder.add(f);
      pivot.add(holder);
    }
  }
  return pivot;
}

export function buildPegasus() {
  const g = new THREE.Group();
  g.name = 'pegasus';
  const body = capsule(0.42, 1.3, COAT);
  body.rotation.x = Math.PI / 2;
  body.position.y = 1.45;
  g.add(body);

  const neck = capsule(0.2, 0.7, COAT);
  neck.position.set(0, 2.0, 0.85);
  neck.rotation.x = 0.6;
  g.add(neck);
  const head = capsule(0.17, 0.45, COAT);
  head.position.set(0, 2.35, 1.25);
  head.rotation.x = 1.9;
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), COAT);
    ear.position.set(s * 0.07, 2.6, 1.08);
    g.add(ear);
  }
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.22), MANE);
  mane.position.set(0, 2.15, 0.72);
  mane.rotation.x = 0.6;
  g.add(mane);
  const tail = capsule(0.08, 0.7, MANE);
  tail.position.set(0, 1.3, -1.15);
  tail.rotation.x = -0.5;
  g.add(tail);

  const legs = [];
  for (const [x, z] of [[-0.22, 0.6], [0.22, 0.6], [-0.22, -0.6], [0.22, -0.6]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 1.25, z);
    const l = capsule(0.07, 0.95, COAT);
    l.position.y = -0.6;
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8), HOOF);
    hoof.position.y = -1.15;
    leg.add(l, hoof);
    g.add(leg);
    legs.push(leg);
  }

  const wL = wing(-1);
  const wR = wing(1);
  for (const w of [wL, wR]) {
    w.position.set(0, 1.8, 0.35);
    g.add(w);
  }

  g.userData = { legs, wings: [wL, wR], tail };
  return g;
}

/** Deterministic flight path over the lake for pegasus i at time t (seconds). */
export function flightPosition(i, t, out = new THREE.Vector3()) {
  const { x, z, rx, rz } = LAYOUT.lake;
  const speed = 0.16 + i * 0.025;
  const a = t * speed + i * 1.7;
  const wob = Math.sin(t * 0.37 + i) * 0.18;
  const px = x + Math.cos(a) * (rx * (0.75 + wob));
  const pz = z + Math.sin(a) * (rz * (0.75 + wob));
  const ground = Math.max(heightAt(px, pz), LAYOUT.lake.level);
  out.set(px, ground + 14 + i * 3 + Math.sin(t * 0.6 + i * 2) * 4, pz);
  return out;
}

export function createPegasi(scene, ctx, { count = 4 } = {}) {
  const list = [];
  const paddock = ctx.anchors.stables;
  for (let i = 0; i < count; i++) {
    const p = buildPegasus();
    p.position.set(paddock.x - 8 + i * 4, paddock.y, paddock.z + 18);
    p.rotation.y = i * 0.9;
    scene.add(p);
    list.push(p);
  }
  const prev = new THREE.Vector3();
  const next = new THREE.Vector3();
  let time = 0;

  function update(dt, sceneId, progress) {
    time += dt;
    const flying = sceneId === 'pegasus';
    list.forEach((p, i) => {
      const { wings, legs, tail } = p.userData;
      if (flying) {
        // ease from the paddock into the flight path during the first 8% of the scene
        flightPosition(i, time, next);
        flightPosition(i, time - 0.1, prev);
        const k = THREE.MathUtils.smoothstep(progress, 0, 0.08);
        const home = new THREE.Vector3(paddock.x - 8 + i * 4, ctx.heightAt(paddock.x - 8 + i * 4, paddock.z + 18), paddock.z + 18);
        p.position.lerpVectors(home, next, k);
        const dir = next.clone().sub(prev);
        p.rotation.y = Math.atan2(dir.x, dir.z);
        p.rotation.z = -Math.sin(time * 0.3 + i) * 0.25;
        const flap = Math.sin(time * 4.5 + i) * 0.7;
        wings[0].rotation.z = 0.25 + flap;
        wings[1].rotation.z = -0.25 - flap;
        for (const [j, l] of legs.entries()) l.rotation.x = j < 2 ? 0.9 : -0.6;
        tail.rotation.x = -1.0;
      } else {
        const hx = paddock.x - 8 + i * 4 + Math.sin(time * 0.05 + i) * 3;
        const hz = paddock.z + 18 + Math.cos(time * 0.04 + i) * 2;
        p.position.set(hx, ctx.heightAt(hx, hz), hz);
        p.rotation.z = 0;
        p.rotation.y += dt * 0.02;
        wings[0].rotation.z = 1.25 + Math.sin(time * 0.8 + i) * 0.04; // folded along the body
        wings[1].rotation.z = -1.25 - Math.sin(time * 0.8 + i) * 0.04;
        for (const l of legs) l.rotation.x = 0;
        tail.rotation.x = -0.5 + Math.sin(time * 1.3 + i) * 0.1;
      }
    });
  }

  return { list, update };
}
