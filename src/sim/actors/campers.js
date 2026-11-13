import * as THREE from 'three';
import { createPlayer } from '../../three/player.js';
import { CABIN_IDS } from '../world/cabins.js';
import { rng } from '../world/noise.js';
import { LAYOUT, inLake } from '../world/layout.js';

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
    // index 0 is the player's slot (the director adds 'me' with index 0); every spot below is
    // a function of the index, so a camper sharing it would stand exactly where the player does
    addMember(mesh, { cabinId, role, index: i + 1 });
  }

  const tmp = new THREE.Vector3();

  function onGround(v, lift = 0) {
    v.y = ctx.heightAt(v.x, v.z) + lift;
    return v;
  }

  function ringPoint(center, radius, angle, lift = 0) {
    return onGround(new THREE.Vector3(center.x + Math.cos(angle) * radius, 0, center.z + Math.sin(angle) * radius), lift);
  }

  const tableOf = (m) => CABIN_IDS.indexOf(m.cabinId) % ctx.pavilionTables.length;
  // the player sits first at their table, then campers in index order: 5 seats a side
  let slots = null;
  let slotsFor = -1;
  function seatSlot(m) {
    if (slotsFor !== members.length) {
      slots = new Map();
      const taken = new Map();
      const order = [...members].sort((a, b) => b.isPlayer - a.isPlayer || a.index - b.index);
      for (const x of order) {
        const t = tableOf(x);
        const n = taken.get(t) ?? 0;
        slots.set(x, n);
        taken.set(t, n + 1);
      }
      slotsFor = members.length;
    }
    return slots.get(m) ?? 0;
  }

  // Arena: one fighter per training dummy (an odd one out takes a dummy's far side), everyone
  // else paired off into duels on open sand between the dummies.
  const DUEL_SPOTS = [[-3.5, -1], [3.5, 1.5], [0, -8.5], [0, 8.5], [-9, -10.5], [9, 10.5], [-13.5, 0.5], [13.5, -0.5], [9, -10.5], [-9, 10.5]];
  let arenaRoles = null;
  let arenaFor = -1;
  function arenaRole(m) {
    if (arenaFor !== members.length) {
      arenaRoles = new Map();
      const fighters = members.filter((x) => x.role === 'fighter').sort((a, b) => a.index - b.index);
      const dummies = ctx.arenaDummies.length;
      const hitters = Math.min(fighters.length, dummies + ((fighters.length - dummies) % 2));
      fighters.forEach((x, k) => {
        if (k < hitters) arenaRoles.set(x, { kind: 'dummy', dummy: k % dummies, far: k >= dummies });
        else arenaRoles.set(x, { kind: 'duel', pair: Math.floor((k - hitters) / 2), side: (k - hitters) % 2 ? 1 : -1 });
      });
      arenaFor = members.length;
    }
    return arenaRoles.get(m);
  }
  function arenaSpot(m) {
    const r = arenaRole(m);
    const A = anchors.arena;
    if (r.kind === 'dummy') {
      const d = ctx.arenaDummies[r.dummy];
      // stand on the arena-centre side of the dummy (or the far side), a sword's reach away
      const out = Math.sign(d.x - A.x) * (r.far ? 1 : -1);
      return { pos: onGround(d.clone().add(new THREE.Vector3(out * 1.15, 0, 0))), pose: 'swing', face: d };
    }
    const [cx, cz] = DUEL_SPOTS[r.pair % DUEL_SPOTS.length];
    const a = r.pair * 1.1 + 0.4;
    const half = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.85);
    const c = new THREE.Vector3(A.x + cx, 0, A.z + cz);
    const foe = c.clone().addScaledVector(half, -r.side);
    return { pos: onGround(c.clone().addScaledVector(half, r.side)), pose: 'swing', face: foe, armor: true };
  }

  // Pegasus watchers. The stables are a 16m x 8m barn around their anchor; stand in an arc on its
  // lake side, clear of the walls (half-diagonal ~9m) so nobody looks at the flights through the roof.
  const S = LAYOUT.stables;
  const toLake = Math.atan2(LAYOUT.lake.z - S.z, LAYOUT.lake.x - S.x);
  function stablesSpot(i) {
    const k = Math.floor(i / 2); // stables get the even indices: rows of six, one spot each
    const row = Math.floor(k / 6);
    const a = toLake + ((k % 6) - 2.5) * 0.2 + (row % 2) * 0.1;
    const r = 11.5 + row * 2.2;
    return onGround(new THREE.Vector3(S.x + Math.cos(a) * r, 0, S.z + Math.sin(a) * r));
  }
  // On the shore side of the dock, never out in the water.
  const D = LAYOUT.dock;
  const L = LAYOUT.lake;
  const shoreward = Math.atan2(D.z - L.z, D.x - L.x);
  function dockSpot(i) {
    const k = Math.floor(i / 2);
    const a = shoreward + ((k * 7) % 11 / 10 - 0.5) * 2.2;
    for (let r = 5 + (k % 3) * 2; ; r += 1.5) {
      const p = new THREE.Vector3(D.x + Math.cos(a) * r, 0, D.z + Math.sin(a) * r);
      if (inLake(p.x, p.z) > 1.1 || r > 30) return onGround(p);
    }
  }

  /** Where member m wants to be (and doing what) at a given scene/progress. */
  function targetFor(m, sceneId, progress) {
    if (m.override) {
      const o = m.override(sceneId, progress);
      if (o) return o;
    }
    const i = m.index;
    const cab = ctx.cabins.get(m.cabinId);
    const door = cab?.userData.worldAnchors.door ?? anchors.green;
    switch (sceneId) {
      case 'dawn': {
        // spill out of the cabins onto the green as the morning goes on
        const out = progress > 0.35 + (i % 7) * 0.06;
        if (!out) {
          // wait beside the porch, not in front of the doorway (the camera walks out through it)
          const fwd = new THREE.Vector3(door.x - cab.position.x, 0, door.z - cab.position.z).normalize();
          const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(i % 2 ? 2.8 + m.jitter.x : -2.8 - m.jitter.x);
          return { pos: onGround(door.clone().add(side).addScaledVector(fwd, 0.5)), pose: 'idle', face: anchors.green };
        }
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
          const mid = targets.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / targets.length);
          const dir = tmp.copy(anchors.archery).sub(mid).setY(0).normalize();
          const slot = Math.floor(i / targets.length) % 3;
          const along = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((slot - 1) * 1.1);
          const pos = tgt.clone().addScaledVector(dir, 22 + slot * 0.4).add(along);
          return { pos: onGround(pos), pose: 'drawBow', face: tgt };
        }
        if (m.role === 'fighter') return arenaSpot(m);
        return { pos: ringPoint(anchors.arena, 15.5, i * 0.7), pose: 'idle', face: anchors.arena };
      }
      case 'pegasus': {
        // gather by the lake shore and stables to watch the flights
        return { pos: i % 2 ? dockSpot(i) : stablesSpot(i), pose: 'idle', face: anchors.lake, lookUp: true };
      }
      case 'dinner': {
        const tables = ctx.pavilionTables;
        const table = tables[tableOf(m)];
        table.updateMatrixWorld(true);
        // seats are handed out per table so nobody sits on someone else's lap. Table frame: benches
        // along x at z=+-0.95 (top 0.49), solid end boards from x=+-1.44 out, so five seats a side
        // stay within +-1.2. A seated camper's hip is 0.42 above their root.
        const k = seatSlot(m);
        const seatX = ((Math.floor(k / 2) % 5) - 2) * 0.6;
        const sideZ = k % 2 ? 0.95 : -0.95;
        const seatPos = new THREE.Vector3(seatX, 0.49 - 0.42, sideZ).applyMatrix4(table.matrixWorld);
        const across = new THREE.Vector3(seatX, 0.49 - 0.42, 0).applyMatrix4(table.matrixWorld);
        // offering window: each camper visits the brazier once in the first half
        const start = m.offerSlot * 0.4;
        if (progress > start && progress < start + 0.07) {
          const a = m.offerSlot * Math.PI * 2;
          return { pos: ringPoint(anchors.brazier, 1.6, a, 0.6), pose: 'idle', face: anchors.brazier, offering: true };
        }
        return { pos: seatPos, pose: 'sit', face: across, seated: true };
      }
      case 'campfire':
      default: {
        const row = i % 3;
        const n = Math.ceil(members.length / 3);
        const k = Math.floor(i / 3);
        const fireToCenter = Math.atan2(anchors.green.z - anchors.campfire.z, anchors.green.x - anchors.campfire.x);
        // seats on the far side of the fire from the camp, on the stone tiers
        const a = fireToCenter + Math.PI + ((k / Math.max(n - 1, 1)) - 0.5) * Math.PI * 0.72;
        // sit on the stone tiers (tier k: radius 6 + 1.3k, top at 0.45(k+1))
        const tier = row + 1;
        const r = 6 + tier * 1.3 - 0.45;
        return { pos: ringPoint(anchors.campfire, r, a, 0.45 * (tier + 1) - 0.42), pose: 'sit', face: anchors.campfire, seated: true };
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
      m.mesh.userData.setArmor?.(!!t.armor);
      m.state = t;
    }
  }

  return { members, addMember, targetFor, update, enterScene };
}
