import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYOUT } from './world/layout.js';

const ease = (k) => k * k * (3 - 2 * k);
const seg = (p, a, b) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

/**
 * Two camera modes:
 *  - overview: scripted cinematic shots per scene; drag to look around, released → glides back.
 *  - first: the player's eyes; drag to turn the head (yaw ±120°, pitch ±60°).
 */
export function createCameras(renderer, ctx) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);
  const dom = renderer.domElement;
  const controls = new OrbitControls(camera, dom);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;

  let mode = 'overview';
  let manual = false;
  let releaseAt = 0;
  let blend = 1; // 0..1 blend from previous camera state into the scripted one
  let time = 0;
  const from = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const shot = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const current = { pos: new THREE.Vector3(30, 40, 60), look: new THREE.Vector3() };
  let lastScene = null;

  // first-person look offsets
  let yaw = 0;
  let pitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let fpBlend = 0;

  const { anchors } = ctx;
  const W = (v) => v.clone();

  function cabinPoint(local) {
    const cab = ctx.cabins.get(ctx.homeCabin);
    cab.updateMatrixWorld(true);
    return local.clone().applyMatrix4(cab.matrixWorld);
  }

  function scripted(sceneId, p, out) {
    const t = time;
    switch (sceneId) {
      case 'dawn': {
        const D = 11;
        const inWindow = cabinPoint(new THREE.Vector3(-0.6, 1.55, -D / 2 + 1.6));
        const windowLook = cabinPoint(new THREE.Vector3(0.6, 0.6, -40));
        const inDoor = cabinPoint(new THREE.Vector3(0, 1.6, D / 2 - 1.2));
        const outDoor = cabinPoint(new THREE.Vector3(0, 1.8, D / 2 + 4));
        const greenHigh = W(anchors.green).add(new THREE.Vector3(26, 30, 42));
        if (p < 0.38) {
          // at the window, a slow drift while the conch sounds
          out.pos.copy(inWindow).add(new THREE.Vector3(Math.sin(t * 0.2) * 0.05, Math.sin(t * 0.3) * 0.03, 0));
          out.look.copy(windowLook);
        } else if (p < 0.58) {
          const k = ease(seg(p, 0.38, 0.58));
          out.pos.lerpVectors(inWindow, inDoor, k);
          out.look.lerpVectors(windowLook, outDoor, Math.min(k * 1.6, 1));
          if (k > 0.6) out.pos.lerpVectors(inDoor, outDoor, ease((k - 0.6) / 0.4));
        } else {
          const k = ease(seg(p, 0.58, 1));
          out.pos.lerpVectors(outDoor, greenHigh, k);
          out.look.lerpVectors(W(anchors.green).setY(2), W(anchors.green), k);
        }
        return;
      }
      case 'overview': {
        const a = -0.4 + p * 1.3;
        out.look.set(8, 0, -10);
        out.pos.set(Math.sin(a) * 85 + 8, 42 - p * 8, Math.cos(a) * 85 - 10);
        return;
      }
      case 'training': {
        if (p < 0.5) {
          const k = seg(p, 0, 0.5);
          const line = anchors.archery;
          const tgt = ctx.archeryTargets[2];
          const side = new THREE.Vector3().subVectors(tgt, line).setY(0).normalize();
          const perp = new THREE.Vector3(-side.z, 0, side.x);
          out.pos.copy(line).addScaledVector(perp, 7 - k * 10).addScaledVector(side, -8).setY(line.y + 2.6);
          out.look.copy(line).addScaledVector(side, 12).addScaledVector(perp, -k * 4).setY(line.y + 1.2);
        } else {
          const k = seg(p, 0.5, 1);
          const a = 1.2 + k * 1.6;
          out.look.copy(anchors.arena).setY(anchors.arena.y + 1);
          out.pos.copy(anchors.arena).add(new THREE.Vector3(Math.cos(a) * 24, 9 - k * 3, Math.sin(a) * 20));
        }
        return;
      }
      case 'pegasus': {
        const { x, z } = LAYOUT.lake;
        const a = 2.4 + p * 0.9;
        const shore = new THREE.Vector3(x + Math.cos(a) * 62, 6 + p * 4, z + Math.sin(a) * 50);
        out.pos.copy(shore).setY(Math.max(ctx.heightAt(shore.x, shore.z), 0) + 6 + p * 4);
        out.look.set(x, 16, z);
        if (ctx.pegasus && p > 0.3) {
          const peg = ctx.pegasus;
          const k = ease(seg(p, 0.3, 0.45));
          out.look.lerp(peg.position, k * 0.9);
          if (p > 0.55) {
            // ride along behind the lead pegasus
            const fwd = new THREE.Vector3(Math.sin(peg.rotation.y), 0, Math.cos(peg.rotation.y));
            const chase = peg.position.clone().addScaledVector(fwd, -9).add(new THREE.Vector3(0, 3.2, 0));
            const kc = ease(seg(p, 0.55, 0.65));
            out.pos.lerp(chase, kc);
            out.look.lerpVectors(out.look, peg.position.clone().addScaledVector(fwd, 12), kc);
          }
        }
        return;
      }
      case 'dinner': {
        const a = 0.6 + p * 1.4;
        out.look.copy(anchors.pavilion).setY(anchors.pavilion.y + 1.2);
        out.pos.copy(anchors.pavilion).add(new THREE.Vector3(Math.cos(a) * 22, 7 - p * 2.5, Math.sin(a) * 22));
        return;
      }
      case 'campfire':
      default: {
        const fire = anchors.campfire;
        const away = new THREE.Vector3(anchors.green.x - fire.x, 0, anchors.green.z - fire.z).normalize();
        const k = ease(seg(p, 0, 0.6));
        const wide = W(fire).addScaledVector(away, 26).setY(fire.y + 12);
        const close = W(fire).addScaledVector(away, 9).setY(fire.y + 2.2);
        out.pos.lerpVectors(wide, close, k);
        if (p > 0.6) {
          // slow arc in the last part, stars above
          const a = (p - 0.6) * 0.9;
          const r = away.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
          out.pos.copy(fire).addScaledVector(r, 9 + (p - 0.6) * 10).setY(fire.y + 2.2 + (p - 0.6) * 14);
        }
        out.look.copy(fire).setY(fire.y + 1.6 + Math.max(0, p - 0.75) * 30);
      }
    }
  }

  dom.addEventListener('pointerdown', (e) => {
    if (mode === 'first') {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    if (!manual) {
      manual = true;
      controls.target.copy(current.look);
      controls.enabled = true;
      controls.update();
    }
    releaseAt = Infinity;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    if (manual) releaseAt = time + 2;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw = THREE.MathUtils.clamp(yaw - (e.clientX - lastX) * 0.004, -2.1, 2.1);
    pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lastY) * 0.004, -1.05, 1.05);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  controls.addEventListener('start', () => { releaseAt = Infinity; });

  function setMode(m) {
    if (m === mode) return;
    from.pos.copy(camera.position);
    from.look.copy(current.look);
    blend = 0;
    mode = m;
    yaw = 0;
    pitch = 0;
    if (manual) { manual = false; controls.enabled = false; }
    ctx.player.userData.head.visible = m !== 'first';
  }

  const eyeLook = new THREE.Vector3();
  function firstPerson(out) {
    const p = ctx.player;
    p.updateMatrixWorld(true);
    const head = p.userData.head;
    head.updateMatrixWorld(true);
    head.getWorldPosition(out.pos);
    out.pos.y += 0.13;
    const baseYaw = p.rotation.y;
    const lookUp = ctx.playerLookUp?.() ?? 0;
    const y = baseYaw + yaw;
    const pt = pitch + lookUp;
    eyeLook.set(Math.sin(y) * Math.cos(pt), Math.sin(pt), Math.cos(y) * Math.cos(pt));
    out.look.copy(out.pos).add(eyeLook.multiplyScalar(10));
    // ease head turns back to centre when not dragging
    if (!dragging) {
      yaw *= 0.995;
      pitch *= 0.995;
    }
  }

  function update(dt, sceneId, progress) {
    time += dt;
    if (sceneId !== lastScene) {
      if (lastScene !== null && mode === 'overview' && !manual) {
        from.pos.copy(camera.position);
        from.look.copy(current.look);
        blend = 0;
      }
      lastScene = sceneId;
    }

    if (manual) {
      controls.update();
      current.look.copy(controls.target);
      if (time > releaseAt) {
        manual = false;
        controls.enabled = false;
        from.pos.copy(camera.position);
        from.look.copy(controls.target);
        blend = 0;
      } else {
        return;
      }
    }

    if (mode === 'first') firstPerson(shot);
    else scripted(sceneId, progress, shot);

    blend = Math.min(blend + dt / (mode === 'first' ? 1.0 : 1.8), 1);
    const k = ease(blend);
    current.pos.lerpVectors(from.pos, shot.pos, k);
    current.look.lerpVectors(from.look, shot.look, k);
    camera.position.copy(current.pos);
    camera.lookAt(current.look);
    fpBlend = mode === 'first' ? 1 : 0;
    camera.fov = THREE.MathUtils.lerp(camera.fov, fpBlend ? 70 : 50, 0.08);
    camera.updateProjectionMatrix();
  }

  /** Jump straight to the scripted shot (no blend) – used on start and after skipping. */
  function snap(sceneId, progress) {
    lastScene = sceneId;
    if (mode === 'first') firstPerson(shot);
    else scripted(sceneId, progress, shot);
    from.pos.copy(shot.pos);
    from.look.copy(shot.look);
    current.pos.copy(shot.pos);
    current.look.copy(shot.look);
    blend = 1;
    camera.position.copy(shot.pos);
    camera.lookAt(shot.look);
  }

  return {
    camera,
    get mode() { return mode; },
    setMode,
    toggle() { setMode(mode === 'first' ? 'overview' : 'first'); },
    update,
    snap,
    focus: () => current.look,
    dispose() { controls.dispose(); },
  };
}
