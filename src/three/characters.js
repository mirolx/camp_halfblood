import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Rigged campers from Quaternius' Ultimate Modular Men / Women packs (CC0, quaternius.com).
// All five share one 62-bone skeleton and the same 24 clips; they face +Z and stand ~1.8m tall.
// `shirt` names the material(s) repainted camp orange; `recolor` repaints anything else.
const BASE = `${import.meta.env?.BASE_URL ?? '/'}assets/models/campers/`;
export const CHARACTER_MODELS = {
  male: [
    { file: 'male_casual.glb', shirt: ['LightBrown'] },
    { file: 'male_beach.glb', shirt: ['LightBrown'], recolor: { Red_Dark: '#2f3b52' } },
    { file: 'male_adventurer.glb', shirt: ['Green'], recolor: { LightGreen: '#c9b48a' } },
  ],
  female: [
    { file: 'female_casual.glb', shirt: ['White'], recolor: { Orange: '#34445e' } },
    { file: 'female_adventurer.glb', shirt: ['LightGreen'], recolor: { Green: '#5a3b22' } },
  ],
};

const CAMP_ORANGE = '#f28c28';
const SKIN_MATS = ['Skin', 'Skin_Darker'];
const HAIR_MATS = ['Hair', 'Hair_Brown', 'Hair_Blond'];

/** gender -> [{ scene, animations, spec }] once loaded; empty means "use the block figures". */
const registry = { male: [], female: [] };

export function registerCharacterModel(gender, spec, gltf) {
  registry[gender].push({ scene: gltf.scene, animations: gltf.animations, spec });
}

export function clearCharacterModels() {
  registry.male.length = 0;
  registry.female.length = 0;
}

export function characterTemplate(gender, seed = 0) {
  const list = registry[gender] ?? [];
  return list.length ? list[seed % list.length] : null;
}

/** Load every camper model that exists. Missing or broken files are skipped. */
export async function loadCharacterModels() {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(CHARACTER_MODELS).flatMap(([gender, specs]) =>
      specs.map(async (spec) => {
        try {
          registerCharacterModel(gender, spec, await loader.loadAsync(BASE + spec.file));
        } catch (err) {
          console.info(`[characters] ${spec.file}: skipped (${err.message})`);
        }
      }),
    ),
  );
  // keep a stable order regardless of which file finished first
  for (const g of Object.keys(registry)) {
    registry[g].sort((a, b) => CHARACTER_MODELS[g].indexOf(a.spec) - CHARACTER_MODELS[g].indexOf(b.spec));
  }
  return registry;
}

// Repainted materials are shared between campers with the same look.
const paintCache = new Map();
function painted(base, color) {
  const key = `${base.uuid}|${color}`;
  if (!paintCache.has(key)) {
    const m = base.clone();
    m.color.set(color);
    paintCache.set(key, m);
  }
  return paintCache.get(key);
}

// Bronze cuirass for duelists: lathe shells fitted around the torso (radii are fractions of
// the torso's half-width / half-depth), each riding the bone that bends that part of the body.
const BRONZE = new THREE.MeshStandardMaterial({ color: '#b8863b', metalness: 0.55, roughness: 0.38 });
const LEATHER = new THREE.MeshStandardMaterial({ color: '#5a3b22', roughness: 0.85 });
const lathe = (profile) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 20);
const CHEST_PLATE = lathe([[0.86, 1.22], [0.97, 1.31], [1, 1.4], [0.9, 1.47], [0.5, 1.51]]);
const BELLY_PLATE = lathe([[0.98, 1.0], [0.88, 1.06], [0.83, 1.14], [0.87, 1.25]]);
const PAULDRON = new THREE.SphereGeometry(0.095, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const STRAP = new THREE.BoxGeometry(0.075, 0.17, 0.02);

function buildArmor(model, B, gender) {
  const hips = model.getObjectByName('Hips');
  const torso = model.getObjectByName('Torso') ?? B.chest;
  model.updateMatrixWorld(true);
  const at = (b) => b.getWorldPosition(new THREE.Vector3());
  const c = at(B.chest);
  const rx = 0.205;
  const rz = gender === 'female' ? 0.165 : 0.14; // room for the bust
  const cz = c.z + (gender === 'female' ? 0.03 : 0.01);
  const parts = [];
  const add = (mesh, bone) => {
    mesh.castShadow = true;
    mesh.visible = false;
    model.add(mesh);
    mesh.updateMatrixWorld(true);
    bone.attach(mesh); // keep the fitted model-space placement, follow the bone from now on
    parts.push(mesh);
  };
  for (const [geo, bone] of [[CHEST_PLATE, B.chest], [BELLY_PLATE, torso]]) {
    const m = new THREE.Mesh(geo, BRONZE);
    m.position.set(c.x, 0, cz);
    m.scale.set(rx, 1, rz);
    add(m, bone);
  }
  for (const s of ['L', 'R']) {
    const arm = at(B[`upperArm${s}`]);
    const out = Math.sign(arm.x - c.x);
    const p = new THREE.Mesh(PAULDRON, BRONZE);
    p.position.set(arm.x + out * 0.07, arm.y + 0.02, arm.z);
    p.scale.set(1, 0.8, 1.15);
    p.rotation.z = -out * 0.5; // dome tipped out over the shoulder
    add(p, B[`upperArm${s}`]);
  }
  // pteruges: leather strips hanging from the cuirass over the hips
  if (hips) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const s = new THREE.Mesh(STRAP, LEATHER);
      s.position.set(c.x + Math.sin(a) * rx * 1.0, 0.92, cz + Math.cos(a) * rz * 1.05);
      s.rotation.y = a;
      add(s, hips);
    }
  }
  return parts;
}

const CLIPS = { idle: 'Idle', walk: 'Walk', run: 'Run', sit: 'Idle_Neutral', drawBow: 'Idle_Neutral', swing: 'Sword_Slash' };
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const SIT_DROP = 0.42;

/**
 * Build a rigged camper from a loaded template. Returns the same shape as the block figure:
 * a Group whose userData has { gender, setPose, update, getPose, head, hair }.
 */
export function buildRiggedPlayer(gender, look, tpl, { bow, sword, poses }) {
  const seed = look.seed ?? 0;
  const { spec } = tpl;
  const model = cloneSkinned(tpl.scene);
  const colorFor = (name) => {
    if (spec.shirt.includes(name)) return look.shirt ?? CAMP_ORANGE;
    if (SKIN_MATS.includes(name) && look.skinFor) return look.skinFor(name);
    if (HAIR_MATS.includes(name) && look.hair) return look.hair;
    return spec.recolor?.[name];
  };
  let hair = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    const c = colorFor(o.material.name);
    if (c) o.material = painted(o.material, c);
    if (HAIR_MATS.includes(o.material.name) && !hair) hair = o;
  });

  const root = new THREE.Group();
  root.name = 'player';
  root.add(model);

  const bone = (n) => model.getObjectByName(n);
  const B = {
    head: bone('Head'),
    upperLegL: bone('UpperLegL'), upperLegR: bone('UpperLegR'),
    lowerLegL: bone('LowerLegL'), lowerLegR: bone('LowerLegR'),
    upperArmL: bone('UpperArmL'), upperArmR: bone('UpperArmR'),
    lowerArmL: bone('LowerArmL'), lowerArmR: bone('LowerArmR'),
    wristL: bone('WristL'), wristR: bone('WristR'),
    chest: bone('Chest'),
  };
  // not every clip keys every bone, so overridden bones are put back to rest before each mix
  // (otherwise the pose turns would pile up frame after frame)
  const rest = Object.values(B).map((b) => [b, b.quaternion.clone()]);

  // bow is held in model space at the left hand (its grip must stay upright whatever the wrist does);
  // the sword rides the right wrist so it follows the slash
  model.add(bow);
  B.wristR.add(sword);
  sword.position.set(0, 0.08, 0.02);
  sword.rotation.set(0, 0, -Math.PI / 2); // blade out past the thumb (wrist -X)

  const armor = buildArmor(model, B, gender);
  let armored = false;
  function setArmor(on) {
    if (on === armored) return;
    armored = on;
    for (const p of armor) p.visible = on;
  }

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  const rand = mulberry(seed * 7 + 3);
  for (const [pose, clipName] of Object.entries(CLIPS)) {
    const clip = tpl.animations.find((a) => a.name === clipName);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    a.time = rand() * clip.duration; // campers don't breathe in unison
    actions[pose] = a;
  }

  let pose = 'idle';
  let current = null;
  let phase = rand() * Math.PI * 2;

  function play(key, fade = 0.25) {
    const next = actions[key] ?? actions.idle;
    if (next === current) return;
    next.reset().setEffectiveWeight(1).fadeIn(current ? fade : 0).play();
    next.time = rand() * next.getClip().duration;
    current?.fadeOut(fade);
    current = next;
  }

  function setPose(p) {
    if (!poses.includes(p)) throw new Error(`Unknown pose: ${p}`);
    pose = p;
    bow.visible = p === 'drawBow';
    sword.visible = p === 'swing';
  }

  // rotate a bone about an axis given in model space (model faces +Z, its left is +X)
  const qParent = new THREE.Quaternion();
  const qModel = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const qRot = new THREE.Quaternion();
  function turn(b, modelAxis, angle) {
    model.getWorldQuaternion(qModel).invert();
    b.parent.getWorldQuaternion(qParent);
    qParent.premultiply(qModel).invert(); // model space -> parent space
    axis.copy(modelAxis).applyQuaternion(qParent);
    b.quaternion.premultiply(qRot.setFromAxisAngle(axis, angle));
    b.updateMatrixWorld(true);
  }

  const wrist = new THREE.Vector3();
  function overrides() {
    model.position.y = pose === 'sit' ? -SIT_DROP : 0;
    if (pose !== 'sit' && pose !== 'drawBow') return;
    root.updateMatrixWorld(true);
    if (pose === 'sit') {
      for (const s of ['L', 'R']) {
        turn(B[`upperLeg${s}`], X, -1.5);
        turn(B[`lowerLeg${s}`], X, 1.5);
        turn(B[`upperArm${s}`], X, -0.3);
        turn(B[`lowerArm${s}`], X, -0.35);
      }
    } else {
      const pull = Math.sin(phase) * 0.5 + 0.5;
      turn(B.chest, Y, 0.35);
      turn(B.upperArmL, X, -1.65);
      turn(B.upperArmL, Y, 0.2);
      turn(B.upperArmR, X, -1.7);
      turn(B.upperArmR, Y, -0.35);
      turn(B.lowerArmR, Y, 2.3 + pull * 0.4);
      B.wristL.getWorldPosition(wrist);
      bow.position.copy(model.worldToLocal(wrist));
      bow.position.z -= 0.5; // grip sits in the hand, string toward the archer
    }
  }

  function update(dt, speed = 1) {
    phase += dt * 1.6;
    const key = pose === 'walk' && speed > 1.3 ? 'run' : pose;
    play(key);
    if (current) current.timeScale = key === 'walk' || key === 'run' ? speed / (key === 'run' ? 1.6 : 1) : 1;
    for (const [b, q] of rest) b.quaternion.copy(q);
    mixer.update(dt);
    overrides();
  }

  root.userData = { gender, setPose, setArmor, update, getPose: () => pose, head: B.head, hair, rigged: true };
  setPose('idle');
  update(0);
  return root;
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
