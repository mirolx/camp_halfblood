import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
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

// Rigged horse from Quaternius' Ultimate Animated Animals (Horse_White, CC0, quaternius.com),
// scaled from ~4.8m to the old figure's size; the feather wings above ride on its back.
const HORSE_FILE = 'pegasus_horse.glb';
const HORSE_SCALE = 0.55;
const HORSE_COLORS = { Main: '#f3f0ea', Main_Light: '#dcd6cc', Hair: '#e8e2d6' };
let horse = null; // { scene, animations } once loaded

export function registerPegasusModel(gltf) {
  horse = gltf ? { scene: gltf.scene, animations: gltf.animations } : null;
}

/** Load the horse model; on failure the primitive pegasus is used. */
export async function loadPegasusModel() {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  try {
    registerPegasusModel(await new GLTFLoader().loadAsync(`${import.meta.env?.BASE_URL ?? '/'}assets/models/${HORSE_FILE}`));
  } catch (err) {
    console.info(`[pegasus] using primitive pegasus (${err.message})`);
  }
}

const horseMats = new Map();
function horseMat(base) {
  const color = HORSE_COLORS[base.name];
  if (!color) return base;
  if (!horseMats.has(base.uuid)) {
    const m = base.clone();
    m.color.set(color);
    horseMats.set(base.uuid, m);
  }
  return horseMats.get(base.uuid);
}

// grazing horses don't all do the same thing
const GROUND_CLIPS = ['Idle', 'Eating', 'Idle_Headlow', 'Idle_2'];

function buildRiggedPegasus(index) {
  const g = new THREE.Group();
  g.name = 'pegasus';
  const model = cloneSkinned(horse.scene);
  model.scale.setScalar(HORSE_SCALE);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = horseMat(o.material);
  });
  g.add(model);

  const wL = wing(-1);
  const wR = wing(1);
  for (const w of [wL, wR]) {
    w.scale.setScalar(1.5);
    g.add(w);
  }
  const withers = model.getObjectByName('Torso2');
  const back = new THREE.Vector3();

  const mixer = new THREE.AnimationMixer(model);
  const clip = (n) => horse.animations.find((a) => a.name === n);
  const ground = mixer.clipAction(clip(GROUND_CLIPS[index % GROUND_CLIPS.length]) ?? clip('Idle'));
  const air = mixer.clipAction(clip('Gallop'));
  air.timeScale = 0.55; // a slow stride reads as running on air, not panic
  ground.time = index * 0.9;
  ground.play();
  let flying = false;

  function setFlying(f) {
    if (f === flying) return;
    flying = f;
    const [from, to] = f ? [ground, air] : [air, ground];
    to.reset().fadeIn(0.6).play();
    from.fadeOut(0.6);
  }

  function update(dt) {
    mixer.update(dt);
    // keep the wings on the withers as the back rises and falls
    g.updateMatrixWorld(true);
    withers.getWorldPosition(back);
    g.worldToLocal(back);
    for (const w of [wL, wR]) w.position.set(0, back.y + 0.12, back.z + 0.25);
  }

  g.userData = { wings: [wL, wR], legs: [], tail: null, rigged: true, setFlying, update };
  update(0);
  return g;
}

export function buildPegasus(index = 0) {
  if (horse) return buildRiggedPegasus(index);
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
    w.scale.setScalar(1.5);
    g.add(w);
  }

  g.userData = { legs, wings: [wL, wR], tail };
  return g;
}

/**
 * Spread and flapping in flight; on the ground swept back along the back with a slight droop,
 * so the long feathers lie over the flanks instead of hanging into the grass.
 * wings[0] reaches toward -X, wings[1] toward +X.
 */
export function poseWings(wings, flying, time, i = 0) {
  if (flying) {
    const flap = Math.sin(time * 4.5 + i) * 0.7;
    wings[0].rotation.set(0, 0, 0.25 + flap, 'XYZ');
    wings[1].rotation.set(0, 0, -0.25 - flap, 'XYZ');
    for (const w of wings) w.scale.setScalar(1.5);
  } else {
    // roll the fan upright against the flank, droop a little, then sweep back toward the tail
    const breathe = Math.sin(time * 0.8 + i) * 0.03;
    wings[0].rotation.set(-1.0, -1.45, 0.12 + breathe, 'YZX');
    wings[1].rotation.set(-1.0, 1.45, -0.12 - breathe, 'YZX');
    for (const w of wings) w.scale.setScalar(0.95);
  }
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
    const p = buildPegasus(i);
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
      const { wings, legs, tail, rigged } = p.userData;
      if (rigged) p.userData.setFlying(flying);
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
        poseWings(wings, true, time, i);
        if (!rigged) {
          for (const [j, l] of legs.entries()) l.rotation.x = j < 2 ? 0.9 : -0.6;
          tail.rotation.x = -1.0;
        }
      } else {
        const hx = paddock.x - 8 + i * 4 + Math.sin(time * 0.05 + i) * 3;
        const hz = paddock.z + 18 + Math.cos(time * 0.04 + i) * 2;
        p.position.set(hx, ctx.heightAt(hx, hz), hz);
        p.rotation.z = 0;
        p.rotation.y += dt * 0.02;
        poseWings(wings, false, time, i);
        if (!rigged) {
          for (const l of legs) l.rotation.x = 0;
          tail.rotation.x = -0.5 + Math.sin(time * 1.3 + i) * 0.1;
        }
      }
      if (rigged) p.userData.update(dt);
    });
  }

  return { list, update };
}
