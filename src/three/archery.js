import * as THREE from 'three';

// Archery for the rigged campers: a timed shot cycle (quiver -> nock -> raise -> draw -> hold ->
// release -> follow-through -> lower), arms placed by two-bone IK on hand targets, a string that
// follows the drawing hand, and arrows that fly to the target and stick.
//
// Model space: the model faces +Z, its left is +X. While shooting the body turns side-on so the
// left (bow) shoulder points at the target.

const ARROW_LEN = 0.75;
const SIDE_ON = -Math.PI / 2 + 0.12; // model yaw while shooting (slightly open stance)
const STUCK_MAX = 3; // arrows left in the target per archer
const SPEED = 48; // m/s

const arrowMats = {
  shaft: new THREE.MeshStandardMaterial({ color: '#c8a26a', roughness: 0.7 }),
  head: new THREE.MeshStandardMaterial({ color: '#8a8f96', roughness: 0.35, metalness: 0.6 }),
  fletch: new THREE.MeshStandardMaterial({ color: '#c9302c', roughness: 0.8, side: THREE.DoubleSide }),
};
const arrowGeo = {
  shaft: new THREE.CylinderGeometry(0.006, 0.006, ARROW_LEN - 0.06, 5).rotateX(Math.PI / 2).translate(0, 0, -(ARROW_LEN - 0.06) / 2 - 0.06),
  head: new THREE.ConeGeometry(0.014, 0.06, 6).rotateX(Math.PI / 2).translate(0, 0, -0.03),
  fletch: new THREE.PlaneGeometry(0.012, 0.11).rotateX(Math.PI / 2).translate(0, 0.012, -ARROW_LEN + 0.07),
};

/** Arrow with its tip at the origin, shaft running back along -Z. */
export function makeArrow() {
  const g = new THREE.Group();
  g.name = 'arrow';
  g.add(new THREE.Mesh(arrowGeo.shaft, arrowMats.shaft), new THREE.Mesh(arrowGeo.head, arrowMats.head));
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Mesh(arrowGeo.fletch, arrowMats.fletch);
    f.rotation.z = (k * Math.PI * 2) / 3;
    g.add(f);
  }
  g.traverse((o) => { o.castShadow = o.isMesh; });
  return g;
}

/** Quiver on the back with a few fletchings showing; built in model space, rides the chest bone. */
function makeQuiver() {
  const q = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.85 }));
  body.castShadow = true;
  q.add(body);
  const fletchBox = new THREE.BoxGeometry(0.008, 0.1, 0.03);
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Mesh(fletchBox, arrowMats.fletch);
    f.position.set(Math.cos(k * 1.6) * 0.025, 0.3, Math.sin(k * 1.6) * 0.025);
    f.rotation.y = k * 0.8;
    q.add(f);
  }
  return q;
}

const smooth = (x) => x * x * (3 - 2 * x);

// cycle keyframes: [time (s), left-hand state, right-hand state]; states are resolved per frame
const KEYS = [
  [0.0, 'low', 'hang'],
  [0.6, 'low', 'quiver'],
  [1.0, 'half', 'quiver'],
  [1.5, 'half', 'nock'],
  [2.1, 'full', 'nock'],
  [3.0, 'full', 'anchor'],
  [3.8, 'full', 'anchor'], // release at the end of the hold
  [3.95, 'full', 'follow'],
  [4.6, 'full', 'follow'],
  [5.3, 'low', 'hang'],
];
const RELEASE = 3.8;
const CYCLE = 5.3;

/**
 * @param {{model:THREE.Object3D, root:THREE.Object3D, B:object, bow:THREE.Object3D, rand:()=>number}} o
 */
export function createArcher({ model, root, B, bow, rand }) {
  const quiver = makeQuiver();
  quiver.position.set(-0.1, 1.3, -0.17);
  quiver.rotation.z = 0.35;
  quiver.rotation.x = -0.12;
  model.add(quiver);
  model.updateMatrixWorld(true);
  B.chest.attach(quiver);
  quiver.visible = false;

  const held = makeArrow();
  held.visible = false;
  model.add(held);

  const flights = []; // { mesh, from, to, t, dur }
  const stuck = [];

  let t = 0;
  let released = false;
  let aim = null; // world-space target base (Vector3) or null
  let active = false;

  // scratch
  const v = () => new THREE.Vector3();
  const S = v(), E = v(), W = v(), T = v(), P = v(), D = v(), Ep = v(), a1 = v(), a2 = v();
  const qA = new THREE.Quaternion(), qW = new THREE.Quaternion(), qP = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const shL = v(), shR = v(), aimDir = v(), tgtCenter = v(), tmp = v(), tmp2 = v();
  const handL = {}, handR = {};
  const m4 = new THREE.Matrix4();

  // world-space rotate `bone` so that the direction `from` lines up with `to`
  function aimBone(bone, from, to) {
    qA.setFromUnitVectors(a1.copy(from).normalize(), a2.copy(to).normalize());
    bone.getWorldQuaternion(qW).premultiply(qA);
    bone.parent.getWorldQuaternion(qP).invert();
    bone.quaternion.copy(qP.multiply(qW));
    bone.updateMatrixWorld(true);
  }

  // two-bone IK in world space: shoulder -> elbow -> wrist reaches T, elbow bends toward `pole`
  function solveArm(upper, lower, wrist, target, pole) {
    upper.getWorldPosition(S);
    lower.getWorldPosition(E);
    wrist.getWorldPosition(W);
    const a = S.distanceTo(E);
    const b = E.distanceTo(W);
    D.copy(target).sub(S);
    const d = THREE.MathUtils.clamp(D.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
    D.normalize();
    const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    P.copy(pole).addScaledVector(D, -pole.dot(D));
    if (P.lengthSq() < 1e-6) P.set(0, -1, 0);
    P.normalize();
    Ep.copy(S).addScaledVector(D, a * cosA).addScaledVector(P, a * Math.sqrt(1 - cosA * cosA));
    aimBone(upper, tmp.copy(E).sub(S), tmp2.copy(Ep).sub(S));
    lower.getWorldPosition(E);
    wrist.getWorldPosition(W);
    T.copy(S).addScaledVector(D, d);
    aimBone(lower, tmp.copy(W).sub(E), tmp2.copy(T).sub(E));
  }

  const toWorld = (p) => model.localToWorld(p);
  const toModel = (p) => model.worldToLocal(p);
  const modelDir = (p) => p.transformDirection(m4.copy(model.matrixWorld).invert());
  const worldDir = (p) => p.transformDirection(model.matrixWorld);

  function setAim(target) {
    aim = target;
  }

  function enter() {
    active = true;
    t = -rand() * 1.8; // stand a moment first so the line doesn't shoot in unison
    released = false;
    quiver.visible = true;
  }

  function leave() {
    active = false;
    quiver.visible = false;
    held.visible = false;
    bow.userData.setNock?.(null);
    model.rotation.y = 0;
  }

  // states -> model-space hand (wrist) targets and elbow poles
  function leftState(name, reach, out) {
    out.pos ??= v();
    out.pole ??= v();
    if (name === 'low') {
      out.pos.copy(shL).add(tmp.set(0.08, -reach * 0.86, 0.14));
      out.pole.set(0.2, -0.3, -1);
    } else if (name === 'half') {
      out.pos.copy(shL).addScaledVector(aimDir, reach * 0.55).add(tmp.set(0, -0.22, 0.12));
      out.pole.set(0, -1, -0.4);
    } else {
      out.pos.copy(shL).addScaledVector(aimDir, reach * 0.97);
      out.pole.set(0, -0.4, -1); // elbow rolled out of the string's path
    }
  }

  function rightState(name, reach, out, stringRest, anchor) {
    out.pos ??= v();
    out.pole ??= v();
    if (name === 'hang') {
      out.pos.copy(shR).add(tmp.set(-0.05, -reach * 0.88, 0.06));
      out.pole.set(-0.3, -0.2, -1);
    } else if (name === 'quiver') {
      out.pos.copy(shR).add(tmp.set(0.02, 0.2, -0.22));
      out.pole.set(-0.6, 1, 0.2);
    } else if (name === 'nock') {
      out.pos.copy(stringRest).addScaledVector(aimDir, -0.06);
      out.pole.set(-0.5, -0.6, 0.2);
    } else if (name === 'anchor') {
      out.pos.copy(anchor).addScaledVector(aimDir, -0.06);
      out.pole.copy(aimDir).negate().add(tmp.set(0, 0.35, 0)); // elbow high behind, in line with the arrow
    } else {
      out.pos.copy(anchor).addScaledVector(aimDir, -0.17).add(tmp.set(0, 0.02, -0.04));
      out.pole.copy(aimDir).negate().add(tmp.set(0, 0.3, 0));
    }
  }

  function lerpState(k, side, reach, stringRest, anchor) {
    // find segment
    let i = 0;
    while (i < KEYS.length - 2 && k >= KEYS[i + 1][0]) i++;
    const [t0, l0, r0] = KEYS[i];
    const [t1, l1, r1] = KEYS[i + 1];
    const f = smooth(THREE.MathUtils.clamp((k - t0) / (t1 - t0), 0, 1));
    const A = {}, Bs = {};
    if (side === 'L') {
      leftState(l0, reach, A);
      leftState(l1, reach, Bs);
    } else {
      rightState(r0, reach, A, stringRest, anchor);
      rightState(r1, reach, Bs, stringRest, anchor);
    }
    return { pos: A.pos.lerp(Bs.pos, f), pole: A.pole.lerp(Bs.pole, f).normalize() };
  }

  const bowBasis = { x: v(), y: v(), z: v() };
  const grip = v(), stringRest = v(), anchor = v(), nock = v(), headP = v();

  /** Call after the clip has been mixed for this frame. */
  function apply() {
    if (!active) return;
    // 1) turn side-on, then turn chest and head back toward the target
    model.rotation.y = SIDE_ON;
    root.updateMatrixWorld(true);
    const k = Math.max(t, 0);
    const turnY = (bone, ang) => {
      bone.getWorldQuaternion(qW);
      bone.parent.getWorldQuaternion(qP);
      worldDir(tmp.set(0, 1, 0));
      qA.setFromAxisAngle(tmp, ang);
      bone.quaternion.copy(qP.invert().multiply(qA.multiply(qW)));
      bone.updateMatrixWorld(true);
    };
    const drawn = k > 1.6 && k < 4.9 ? 1 : 0.4;
    turnY(B.chest, 0.25 * drawn);
    turnY(B.head, 1.15 * drawn + 0.2);

    // 2) aim direction in model space, from the bow shoulder to the target's centre
    toModel(B.upperArmL.getWorldPosition(shL));
    toModel(B.upperArmR.getWorldPosition(shR));
    if (aim) {
      toModel(tgtCenter.copy(aim).add(tmp.set(0, 1.4, 0)));
    } else {
      toModel(root.localToWorld(tgtCenter.set(0, 1.4, 30)));
    }
    aimDir.copy(tgtCenter).sub(shL).normalize();
    B.upperArmL.getWorldPosition(a1);
    B.lowerArmL.getWorldPosition(a2);
    const reach = a1.distanceTo(a2) + a2.distanceTo(B.wristL.getWorldPosition(W));

    // 3) bow arm
    const L = lerpState(k, 'L', reach);
    solveArm(B.upperArmL, B.lowerArmL, B.wristL, toWorld(L.pos), worldDir(L.pole));

    // 4) bow: belly toward the target, limbs up, grip in the left palm
    B.wristL.getWorldPosition(W);
    B.lowerArmL.getWorldPosition(E);
    grip.copy(W).addScaledVector(tmp.copy(W).sub(E).normalize(), 0.06);
    toModel(grip);
    // lowered, the bow points forward at the archer's side; raised, its belly faces the target
    const raised = THREE.MathUtils.clamp((grip.y - (shL.y - reach * 0.86)) / (reach * 0.86), 0, 1);
    const flat = tmp.copy(aimDir).setY(aimDir.y * 0.3).normalize();
    bowBasis.z.set(0, 0, 1).lerp(flat, smooth(raised)).normalize();
    bowBasis.x.crossVectors(up, bowBasis.z).normalize();
    bowBasis.y.crossVectors(bowBasis.z, bowBasis.x);
    bow.quaternion.setFromRotationMatrix(m4.makeBasis(bowBasis.x, bowBasis.y, bowBasis.z));
    bow.position.copy(grip).addScaledVector(bowBasis.z, -0.5);
    stringRest.copy(bow.position).addScaledVector(bowBasis.z, 0.19);

    // anchor: under the chin, on the arrow's line
    toModel(B.head.getWorldPosition(headP));
    anchor.copy(shL).add(shR).multiplyScalar(0.5).addScaledVector(aimDir, 0.1);
    anchor.y = Math.min(headP.y, anchor.y + 0.12);

    // 5) draw arm
    const R = lerpState(k, 'R', reach, stringRest, anchor);
    solveArm(B.upperArmR, B.lowerArmR, B.wristR, toWorld(R.pos), worldDir(R.pole));

    // 6) string nock follows the fingers while drawn; the held arrow rides it
    B.wristR.getWorldPosition(W);
    B.lowerArmR.getWorldPosition(E);
    nock.copy(W).addScaledVector(tmp.copy(W).sub(E).normalize(), 0.06);
    toModel(nock);
    const drawing = k >= 2.1 && k < RELEASE;
    if (drawing) {
      bow.userData.setNock?.(tmp.copy(nock).sub(bow.position).applyQuaternion(qA.copy(bow.quaternion).invert()));
    } else if (k >= RELEASE && k < RELEASE + 0.25) {
      // string snaps back and shivers
      const s = (k - RELEASE) / 0.25;
      bow.userData.setNock?.(tmp.set(0, 0, 0.19 + Math.sin(s * 30) * 0.03 * (1 - s)));
    } else {
      bow.userData.setNock?.(null);
    }

    const hasArrow = k >= 0.6 && k < RELEASE;
    held.visible = hasArrow;
    if (hasArrow) {
      // in the hand on the way from the quiver, then on the string pointing at the bow
      const onString = k >= 1.5;
      const tail = onString ? (drawing ? nock : stringRest) : nock;
      const dir = onString ? tmp.copy(aimDir) : tmp.copy(grip).sub(nock).normalize().lerp(up, 0.6).normalize();
      held.position.copy(tail).addScaledVector(dir, ARROW_LEN);
      held.quaternion.setFromUnitVectors(a1.set(0, 0, 1), dir);
    }

    // 7) release
    if (!released && k >= RELEASE) {
      released = true;
      shoot();
    }
  }

  function shoot() {
    const scene = root.parent;
    if (!scene) return;
    const from = held.getWorldPosition(v());
    const center = aim ? aim.clone().add(new THREE.Vector3(0, 1.4, 0)) : root.localToWorld(new THREE.Vector3(0, 1.4, 25));
    const toward = from.clone().sub(center).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(up, toward);
    const r = Math.sqrt(rand()) * 0.42;
    const ang = rand() * Math.PI * 2;
    const to = center.clone().addScaledVector(side, Math.cos(ang) * r).addScaledVector(up, Math.sin(ang) * r).addScaledVector(toward, 0.02);
    const mesh = makeArrow();
    mesh.position.copy(from);
    scene.add(mesh);
    flights.push({ mesh, from, to, t: 0, dur: from.distanceTo(to) / SPEED, lift: 0.25 + rand() * 0.2 });
  }

  const pPrev = v();
  function updateFlights(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t = Math.min(f.t + dt / f.dur, 1);
      const u = f.t;
      pPrev.copy(f.mesh.position);
      f.mesh.position.lerpVectors(f.from, f.to, u).y += f.lift * 4 * u * (1 - u);
      const dir = tmp.copy(f.to).sub(f.from);
      dir.y += f.lift * 4 * (1 - 2 * u);
      f.mesh.quaternion.setFromUnitVectors(a1.set(0, 0, 1), dir.normalize());
      if (u >= 1) {
        flights.splice(i, 1);
        stuck.push(f.mesh);
        if (stuck.length > STUCK_MAX) {
          const old = stuck.shift();
          old.removeFromParent();
        }
      }
    }
  }

  function update(dt) {
    updateFlights(dt);
    if (!active) return;
    t += dt;
    if (t >= CYCLE) {
      t = -rand() * 1.2;
      released = false;
    }
  }

  return { enter, leave, update, apply, setAim };
}
