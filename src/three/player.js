import * as THREE from 'three';

// Stylized demigod figure (~1.7m) in an orange camp shirt.
// Built from simple primitives so dozens can share materials cheaply.

const POSES = ['idle', 'walk', 'sit', 'drawBow', 'swing'];
const SKIN_TONES = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6646', '#6e4630'];
const HAIR_COLORS = ['#2a1d14', '#4a3020', '#7a4f2a', '#c49a5a', '#1a1a1a'];

const matCache = new Map();
function mat(color, opts = {}) {
  const key = `${color}|${opts.roughness ?? 0.8}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.8 }));
  }
  return matCache.get(key);
}

function capsule(radius, length, material, name) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
  m.castShadow = true;
  if (name) m.name = name;
  return m;
}

/**
 * @param {'male'|'female'} gender
 * @param {{shirt?:string, pants?:string, skin?:string, hair?:string, seed?:number}} [look]
 */
export function createPlayer(gender, look = {}) {
  const seed = look.seed ?? 0;
  const skin = mat(look.skin ?? SKIN_TONES[seed % SKIN_TONES.length]);
  const hairMat = mat(look.hair ?? HAIR_COLORS[(seed * 3 + 1) % HAIR_COLORS.length], { roughness: 0.6 });
  const shirt = mat(look.shirt ?? '#f28c28');
  const pants = mat(look.pants ?? '#34445e');
  const shoes = mat('#3a2f28');

  const root = new THREE.Group();
  root.name = 'player';

  // hips pivot at 0.86m
  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.09, 0, 0);
    const thigh = capsule(0.065, 0.62, pants);
    thigh.position.y = -0.4;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoes);
    shoe.position.set(0, -0.82, 0.04);
    shoe.castShadow = true;
    leg.add(thigh, shoe);
    hips.add(leg);
    legs.push(leg);
  }

  const torso = capsule(0.17, 0.32, shirt, 'torso');
  torso.position.y = 0.3;
  torso.scale.set(gender === 'male' ? 1.12 : 0.92, 1, 0.72);
  hips.add(torso);

  const chest = new THREE.Group();
  chest.position.y = 0.5;
  hips.add(chest);

  const arms = [];
  const shoulderX = gender === 'male' ? 0.23 : 0.2;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * shoulderX, 0, 0);
    const sleeve = capsule(0.055, 0.12, shirt);
    sleeve.position.y = -0.08;
    const fore = capsule(0.045, 0.42, skin);
    fore.position.y = -0.33;
    arm.add(sleeve, fore);
    chest.add(arm);
    arms.push(arm);
  }

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.2;
  chest.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), skin);
  neck.position.y = -0.02;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), skin);
  skull.position.y = 0.12;
  skull.scale.set(0.95, 1.08, 1);
  skull.castShadow = true;
  head.add(neck, skull);

  const hair = new THREE.Group();
  hair.name = 'hair';
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.124, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat,
  );
  cap.position.set(0, 0.135, -0.008);
  cap.scale.set(0.98, 1.1, 1.06);
  cap.castShadow = true;
  hair.add(cap);
  if (gender === 'female') {
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), hairMat);
    tie.position.set(0, 0.17, -0.12);
    const tail = capsule(0.045, 0.3, hairMat);
    tail.position.set(0, -0.02, -0.15);
    tail.rotation.x = 0.18;
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), hairMat);
    back.position.set(0, 0.1, -0.03);
    back.scale.set(1.0, 0.95, 1.0);
    hair.add(tie, tail, back);
  } else {
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.08), hairMat);
    fringe.position.set(0, 0.22, 0.07);
    fringe.rotation.x = -0.3;
    hair.add(fringe);
  }
  head.add(hair);

  // props: bow in the left hand, bronze sword in the right
  const bow = new THREE.Group();
  const bowArc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.018, 5, 18, Math.PI * 0.75), mat('#5a3b22', { roughness: 0.6 }));
  bowArc.rotation.set(0, Math.PI / 2, Math.PI * 0.625);
  const bowString = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.92, 4), mat('#e8e2d0'));
  bowString.position.z = -0.19;
  bow.add(bowArc, bowString);
  bow.position.set(0, -0.58, 0.05);
  bow.rotation.x = Math.PI / 2;
  bow.visible = false;
  arms[0].add(bow);
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.015), mat('#c99a4a', { roughness: 0.3 }));
  blade.position.y = -0.45;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.04), mat('#6a4a2a'));
  sword.add(blade, guard);
  sword.position.set(0, -0.6, 0.02);
  sword.rotation.x = Math.PI;
  sword.visible = false;
  arms[1].add(sword);

  let pose = 'idle';
  let phase = Math.random() * Math.PI * 2;

  function setPose(p) {
    if (!POSES.includes(p)) throw new Error(`Unknown pose: ${p}`);
    pose = p;
    bow.visible = p === 'drawBow';
    sword.visible = p === 'swing';
  }

  function update(dt, speed = 1) {
    phase += dt * (pose === 'walk' ? 7 * speed : 1.6);
    const s = Math.sin(phase);
    // reset
    hips.position.y = 0.86;
    hips.rotation.set(0, 0, 0);
    for (const l of legs) l.rotation.set(0, 0, 0);
    for (const a of arms) a.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);

    if (pose === 'walk') {
      legs[0].rotation.x = s * 0.5;
      legs[1].rotation.x = -s * 0.5;
      arms[0].rotation.x = -s * 0.45;
      arms[1].rotation.x = s * 0.45;
      hips.position.y = 0.86 + Math.abs(Math.cos(phase)) * 0.03;
    } else if (pose === 'sit') {
      hips.position.y = 0.46;
      for (const l of legs) l.rotation.x = -1.45;
      arms[0].rotation.x = -0.5;
      arms[1].rotation.x = -0.5;
      head.rotation.x = Math.sin(phase * 0.5) * 0.05;
    } else if (pose === 'drawBow') {
      arms[0].rotation.set(-Math.PI / 2, 0, 0.1); // bow arm straight
      arms[1].rotation.set(-Math.PI / 2 + 0.2, 0, -0.9 - (s * 0.5 + 0.5) * 0.4); // draw arm pulls
      head.rotation.y = 0.15;
    } else if (pose === 'swing') {
      const k = Math.sin(phase * 2.2);
      arms[1].rotation.set(-1.2 + k * 1.0, 0, -0.3);
      arms[0].rotation.set(-0.6, 0, 0.3);
      hips.rotation.y = k * 0.25;
      legs[0].rotation.x = 0.25;
      legs[1].rotation.x = -0.25;
    } else {
      arms[0].rotation.z = 0.06;
      arms[1].rotation.z = -0.06;
      hips.position.y = 0.86 + s * 0.004;
      head.rotation.y = Math.sin(phase * 0.3) * 0.12;
    }
  }

  root.userData = { gender, setPose, update, getPose: () => pose, head, hair };
  update(0);
  return root;
}
