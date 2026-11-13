import * as THREE from 'three';
import { LAYOUT } from './world/layout.js';

const ease = (k) => k * k * (3 - 2 * k);
const seg = (p, a, b) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

/**
 * Two camera modes:
 *  - overview: scripted cinematic shots per scene.
 *  - first: the player's eyes.
 * In both, dragging turns the view around the camera's own position (360° yaw, pitch up to ±80°)
 * on top of whatever the shot is doing, so moving shots keep moving while you look around.
 * The wheel zooms. The offset stays until you double-click / press R, switch view or the scene changes.
 */
export function createCameras(renderer, ctx) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);
  const dom = renderer.domElement;

  let mode = 'overview';
  let blend = 1; // 0..1 blend from previous camera state into the scripted one
  let time = 0;
  const from = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const shot = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const current = { pos: new THREE.Vector3(30, 40, 60), look: new THREE.Vector3() };
  let lastScene = null;

  // free-look offsets: target values set by input, smoothed values applied to the camera
  const look = { yaw: 0, pitch: 0, zoom: 0, yawS: 0, pitchS: 0, zoomS: 0 };
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;

  const { anchors } = ctx;
  const W = (v) => v.clone();

  function cabinPoint(local) {
    const cab = ctx.cabins.get(ctx.homeCabin);
    cab.updateMatrixWorld(true);
    return local.clone().applyMatrix4(cab.matrixWorld);
  }

  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  function yawLook(out, yaw, pitch = 0) {
    out.look.set(out.pos.x + Math.sin(yaw) * 20, out.pos.y + Math.tan(pitch) * 20, out.pos.z + Math.cos(yaw) * 20);
  }
  /** Straight out of the back window, turned toward the lake as far as the window frame allows. */
  function dawnWindowYaw(inWindow) {
    const outward = yawTo(inWindow, cabinPoint(new THREE.Vector3(0, 1.6, -40)));
    const lake = yawTo(inWindow, { x: LAYOUT.lake.x, z: LAYOUT.lake.z });
    const diff = Math.atan2(Math.sin(lake - outward), Math.cos(lake - outward));
    return outward + THREE.MathUtils.clamp(diff, -0.5, 0.5);
  }
  let pathCache = null;
  function dawnPath(cab) {
    if (pathCache?.cab === cab) return pathCache.curve;
    const D = 11;
    const pts = [
      new THREE.Vector3(0, 1.6, -D / 2 + 0.25 + 0.85),
      new THREE.Vector3(1.0, 1.6, -2.2),
      new THREE.Vector3(0.6, 1.6, 1.8),
      new THREE.Vector3(0, 1.7, D / 2 - 0.4),
      new THREE.Vector3(0, 1.8, D / 2 + 4),
    ].map((v) => cabinPoint(v));
    pathCache = { cab, curve: new THREE.CatmullRomCurve3(pts) };
    return pathCache.curve;
  }

  function scripted(sceneId, p, out) {
    const t = time;
    switch (sceneId) {
      case 'dawn': {
        const D = 11;
        const cab = ctx.cabins.get(ctx.homeCabin);
        const inWindow = cabinPoint(cab.userData.anchors.window);
        const outDoor = cabinPoint(new THREE.Vector3(0, 1.8, D / 2 + 4));
        const greenHigh = W(anchors.green).add(new THREE.Vector3(26, 30, 42));
        const windowYaw = dawnWindowYaw(inWindow);
        if (p < 0.38) {
          // at the big back window, a slow breathing drift while the conch sounds
          out.pos.copy(inWindow).add(new THREE.Vector3(0, Math.sin(t * 0.3) * 0.03, 0));
          yawLook(out, windowYaw + Math.sin(t * 0.15) * 0.06, -0.12);
        } else if (p < 0.6) {
          // turn around and walk out through the room and the front door
          const k = ease(seg(p, 0.38, 0.6));
          dawnPath(cab).getPoint(k, out.pos);
          const doorYaw = yawTo(outDoor, W(anchors.green));
          yawLook(out, lerpAngle(windowYaw, doorYaw, ease(seg(k, 0, 0.45))), -0.08);
        } else {
          const k = ease(seg(p, 0.6, 1));
          out.pos.lerpVectors(outDoor, greenHigh, k);
          const ground = W(anchors.green).setY(1.6);
          const lookFrom = outDoor.clone().add(new THREE.Vector3(Math.sin(yawTo(outDoor, ground)) * 20, -0.4, Math.cos(yawTo(outDoor, ground)) * 20));
          out.look.lerpVectors(lookFrom, W(anchors.green), k);
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

  const fov = () => (mode === 'first' ? 70 : 50);
  const resetLook = () => { look.yaw = 0; look.pitch = 0; look.zoom = 0; };

  const onDown = (e) => {
    if (e.button !== 0 || dragging) return;
    dragging = true;
    pointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    dom.setPointerCapture?.(e.pointerId);
    dom.classList.add('dragging');
  };
  const onUp = (e) => {
    if (e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    dom.classList.remove('dragging');
  };
  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    // slower when zoomed in, so the scene moves under the cursor at roughly the same rate
    const k = 0.0035 * (camera.fov / 50);
    look.yaw += (e.clientX - lastX) * k; // grab-style: the scene follows the cursor
    look.pitch = THREE.MathUtils.clamp(look.pitch + (e.clientY - lastY) * k, -1.4, 1.4);
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onWheel = (e) => {
    e.preventDefault();
    look.zoom = THREE.MathUtils.clamp(look.zoom + Math.sign(e.deltaY) * 4, -30, 15);
  };
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('dblclick', resetLook);

  function setMode(m) {
    if (m === mode) return;
    // hard cut (the HUD covers it with a short fade) — gliding between the two views
    // dragged the camera through walls and the player's own body
    blend = 1;
    mode = m;
    resetLook();
    look.yawS = look.pitchS = look.zoomS = 0;
    camera.fov = fov();
    // in first person the camera sits inside 'me': hide the whole body so it can't fill the view
    ctx.player.visible = m !== 'first';
  }

  const eyeLook = new THREE.Vector3();
  function firstPerson(out) {
    const p = ctx.player;
    p.updateMatrixWorld(true);
    const head = p.userData.head;
    head.updateMatrixWorld(true);
    head.getWorldPosition(out.pos);
    out.pos.y += 0.13;
    const y = p.rotation.y;
    const pt = ctx.playerLookUp?.() ?? 0;
    eyeLook.set(Math.sin(y) * Math.cos(pt), Math.sin(pt), Math.cos(y) * Math.cos(pt));
    out.look.copy(out.pos).add(eyeLook.multiplyScalar(10));
  }

  /** Turn the camera's view direction by the free-look offset, keeping its position. */
  const dir = new THREE.Vector3();
  const viewLook = new THREE.Vector3();
  function applyLook(pos, target) {
    dir.subVectors(target, pos);
    const len = dir.length() || 1;
    const baseYaw = Math.atan2(dir.x, dir.z);
    const basePitch = Math.asin(THREE.MathUtils.clamp(dir.y / len, -1, 1));
    const y = baseYaw + look.yawS;
    const pt = THREE.MathUtils.clamp(basePitch + look.pitchS, -1.45, 1.45);
    viewLook.set(Math.sin(y) * Math.cos(pt), Math.sin(pt), Math.cos(y) * Math.cos(pt)).multiplyScalar(len).add(pos);
    camera.position.copy(pos);
    camera.lookAt(viewLook);
  }

  function update(dt, sceneId, progress) {
    time += dt;
    if (sceneId !== lastScene) {
      if (lastScene !== null && mode === 'overview') {
        from.pos.copy(camera.position);
        from.look.copy(current.look);
        blend = 0;
      }
      lastScene = sceneId;
      resetLook(); // new scene, new framing: glide back to what the shot wants to show
    }

    if (mode === 'first') firstPerson(shot);
    else scripted(sceneId, progress, shot);

    blend = Math.min(blend + dt / (mode === 'first' ? 1.0 : 1.8), 1);
    const k = ease(blend);
    current.pos.lerpVectors(from.pos, shot.pos, k);
    current.look.lerpVectors(from.look, shot.look, k);

    const s = 1 - Math.exp(-dt * 14);
    look.yawS += (look.yaw - look.yawS) * s;
    look.pitchS += (look.pitch - look.pitchS) * s;
    look.zoomS += (look.zoom - look.zoomS) * (1 - Math.exp(-dt * 8));
    applyLook(current.pos, current.look);
    camera.fov = fov() + look.zoomS;
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
    resetLook();
    look.yawS = look.pitchS = look.zoomS = 0;
    applyLook(shot.pos, shot.look);
  }

  return {
    camera,
    get mode() { return mode; },
    setMode,
    toggle() { setMode(mode === 'first' ? 'overview' : 'first'); },
    update,
    snap,
    resetLook,
    focus: () => current.look,
    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('dblclick', resetLook);
      dom.classList.remove('dragging');
    },
  };
}
