import * as THREE from 'three';
import { createPlayer } from '../../three/player.js';
import { CABIN_IDS } from '../world/cabins.js';
import { rng } from '../world/noise.js';

const WALK = 1.5; // m/s
const JOG = 3.2;

/**
 * A crowd of campers plus (optionally) the player, all driven by scene targets.
 * ctx: { heightAt, cabins: Map, anchors, archeryTargets, pavilionTables }
 */
export function createCrowd(scene, ctx, { count = 40, seed = 11 } = {}) {
  const rand = rng(seed);
  const members = [];
  const { anchors } = ctx;

  function addMember(mesh, { cabinId, role, isPlayer = false, index }) {
    const m = {
      name: mesh.name || `camper-${members.length}`,
      mesh,
      cabinId,
      role, // 'archer' | 'fighter' | 'watcher'
      isPlayer,
      index: index ?? members.length,
      jitter: new THREE.Vector2(rand() - 0.5, rand() - 0.5),
      offerSlot: rand(),
      pos: mesh.position,
    };
    members.push(m);
    return m;
  }

  for (let i = 0; i < count; i++) {
    const gender = i % 2 ? 'male' : 'female';
    const mesh = createPlayer(gender, { seed: i + 5 });
    mesh.name = `camper-${i}`;
    const cabinId = CABIN_IDS.filter((c) => c !== 'hera' && c !== 'artemis')[i % 10];
    const role = i % 5 === 4 ? 'watcher' : i % 2 ? 'fighter' : 'archer';
    scene.add(mesh);
    addMember(mesh, { cabinId, role });
  }

  const tmp = new THREE.Vector3();

  function onGround(v, lift = 0) {
    v.y = ctx.heightAt(v.x, v.z) + lift;
    return v;
  }

  function ringPoint(center, radius, angle, lift = 0) {
    return onGround(new THREE.Vector3(center.x + Math.cos(angle) * radius, 0, center.z + Math.sin(angle) * radius), lift);
  }

  /** Where member m wants to be (and doing what) at a given scene/progress. */
  function targetFor(m, sceneId, progress) {
    const i = m.index;
    const cab = ctx.cabins.get(m.cabinId);
    const door = cab?.userData.worldAnchors.door ?? anchors.green;
    switch (sceneId) {
      case 'dawn': {
        // spill out of the cabins onto the green as the morning goes on
        const out = progress > 0.35 + (i % 7) * 0.06;
        if (!out) return { pos: door.clone().add(new THREE.Vector3(m.jitter.x, 0, m.jitter.y)), pose: 'idle', face: anchors.green };
        const a = (i / members.length) * Math.PI * 2;
        return { pos: ringPoint(anchors.green, 6 + (i % 5) * 1.8, a), pose: 'idle', face: anchors.green };
      }
      case 'overview': {
        const a = (i * 2.399) + progress * (i % 2 ? 1.2 : -1.2);
        return { pos: ringPoint(anchors.green, 5 + (i % 6) * 1.6, a), pose: 'idle', face: anchors.green };
      }
      case 'training': {
        if (m.role === 'archer') {
          const targets = ctx.archeryTargets;
          const lane = i % targets.length;
          const tgt = targets[lane];
          // stand on the shooting line, 22m in front of the target
          const dir = tmp.copy(anchors.archery).sub(tgt).setY(0).normalize();
          const pos = tgt.clone().addScaledVector(dir, 22).add(new THREE.Vector3(m.jitter.x * 1.2, 0, m.jitter.y * 1.2));
          return { pos: onGround(pos), pose: 'drawBow', face: tgt };
        }
        if (m.role === 'fighter') {
          const pair = Math.floor(i / 2);
          const a = pair * 1.3;
          const c = ringPoint(anchors.arena, 3 + (pair % 4) * 2.2, a);
          const side = i % 2 ? 1 : -1;
          const pos = c.clone().add(new THREE.Vector3(Math.cos(a + 1.57) * side, 0, Math.sin(a + 1.57) * side));
          return { pos: onGround(pos), pose: 'swing', face: c };
        }
        return { pos: ringPoint(anchors.arena, 15.5, i * 0.7), pose: 'idle', face: anchors.arena };
      }
      case 'pegasus': {
        // gather by the lake shore and stables to watch the flights
        const spot = i % 2 ? anchors.dock : anchors.stables;
        const pos = ringPoint(spot, 6 + (i % 4) * 2, i * 1.1);
        return { pos, pose: 'idle', face: anchors.lake, lookUp: true };
      }
      case 'dinner': {
        const tables = ctx.pavilionTables;
        const table = tables[CABIN_IDS.indexOf(m.cabinId) % tables.length];
        table.updateMatrixWorld(true);
        const seat = ((i * 7) % 6) - 2.5;
        const sideZ = i % 2 ? 0.95 : -0.95;
        const seatPos = new THREE.Vector3(seat * 0.6, -0.15, sideZ).applyMatrix4(table.matrixWorld);
        // offering window: each camper visits the brazier once in the first half
        const start = m.offerSlot * 0.4;
        if (progress > start && progress < start + 0.07) {
          const a = m.offerSlot * Math.PI * 2;
          return { pos: ringPoint(anchors.brazier, 1.6, a, 0.6), pose: 'idle', face: anchors.brazier, offering: true };
        }
        return { pos: seatPos, pose: 'sit', face: table.getWorldPosition(new THREE.Vector3()), seated: true };
      }
      case 'campfire':
      default: {
        const row = i % 3;
        const n = Math.ceil(members.length / 3);
        const k = Math.floor(i / 3);
        const fireToCenter = Math.atan2(anchors.green.z - anchors.campfire.z, anchors.green.x - anchors.campfire.x);
        // seats on the far side of the fire from the camp, on the stone tiers
        const a = fireToCenter + Math.PI + ((k / Math.max(n - 1, 1)) - 0.5) * Math.PI * 1.3;
        const r = 6.6 + row * 1.3;
        return { pos: ringPoint(anchors.campfire, r, a, 0.45 * (row + 1) - 0.45), pose: 'sit', face: anchors.campfire, seated: true };
      }
    }
  }

  let currentScene = null;

  /** On scene change, members far from their new target start nearby (just off-camera) and walk in. */
  function enterScene(sceneId, progress = 0) {
    currentScene = sceneId;
    for (const m of members) {
      const t = targetFor(m, sceneId, progress);
      const d = m.mesh.position.distanceTo(t.pos);
      if (d > 30 || !m.placed) {
        const a = m.jitter.x * 6.28;
        const r = m.placed ? 10 + Math.abs(m.jitter.y) * 10 : 0;
        m.mesh.position.set(t.pos.x + Math.cos(a) * r, 0, t.pos.z + Math.sin(a) * r);
        m.mesh.position.y = ctx.heightAt(m.mesh.position.x, m.mesh.position.z);
        m.placed = true;
      }
    }
  }

  function update(dt, sceneId, progress, { skipPlayer = false } = {}) {
    if (sceneId !== currentScene) enterScene(sceneId, progress);
    for (const m of members) {
      if (skipPlayer && m.isPlayer) continue;
      const t = targetFor(m, sceneId, progress);
      const p = m.mesh.position;
      tmp.copy(t.pos).sub(p).setY(0);
      const dist = tmp.length();
      if (dist > 0.25) {
        const speed = dist > 12 ? JOG : WALK;
        tmp.normalize().multiplyScalar(Math.min(speed * dt, dist));
        p.add(tmp);
        p.y = THREE.MathUtils.lerp(p.y, ctx.heightAt(p.x, p.z) + (dist < 1.5 ? t.pos.y - ctx.heightAt(t.pos.x, t.pos.z) : 0), 0.3);
        m.mesh.rotation.y = Math.atan2(tmp.x, tmp.z);
        m.mesh.userData.setPose('walk');
        m.mesh.userData.update(dt, dist > 12 ? 1.6 : 1);
      } else {
        p.y = THREE.MathUtils.lerp(p.y, t.pos.y, 0.3);
        if (t.face) m.mesh.rotation.y = Math.atan2(t.face.x - p.x, t.face.z - p.z);
        m.mesh.userData.setPose(t.pose);
        m.mesh.userData.update(dt);
        if (t.lookUp) m.mesh.userData.head.rotation.x = -0.45;
      }
      m.state = t;
    }
  }

  return { members, addMember, targetFor, update, enterScene };
}
