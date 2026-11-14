import * as THREE from 'three';
import { createPlayer } from '../../three/player.js';
import { CABIN_IDS } from '../world/cabins.js';
import { rng } from '../world/noise.js';
import { LAYOUT, inLake } from '../world/layout.js';

/** Repeatable pseudo-random number in [0, 1) for a pair of integers. */
function hash(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const WALK = 1.5; // m/s
// overview scene beats: wander until GATHER, chat in groups until SCATTER, then head off
const GATHER = 0.3;
const SCATTER = 0.75;
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

  // archers in index order (the player first), so each takes the next free lane/slot
  let ranks = null;
  let ranksFor = -1;
  function archerRank(m) {
    if (ranksFor !== members.length) {
      ranks = new Map();
      const order = members.filter((x) => x.role === 'archer').sort((a, b) => b.isPlayer - a.isPlayer || a.index - b.index);
      order.forEach((x, n) => ranks.set(x, n));
      ranksFor = members.length;
    }
    return ranks.get(m) ?? 0;
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
  // On the shore side of the dock, never out in the water, and never up in the dining pavilion
  // (it stands 23m from the dock): a ray that runs into it swings round to the next angle.
  const D = LAYOUT.dock;
  const L = LAYOUT.lake;
  const shoreward = Math.atan2(D.z - L.z, D.x - L.x);
  function dockSpot(i) {
    const k = Math.floor(i / 2);
    let fallback = null;
    for (let turn = 0; turn < 8; turn++) {
      const a = shoreward + ((k * 7 + turn * 3) % 11 / 10 - 0.5) * 2.2;
      for (let r = 5 + (k % 3) * 2; r <= 30; r += 1.5) {
        const p = new THREE.Vector3(D.x + Math.cos(a) * r, 0, D.z + Math.sin(a) * r);
        if (inLake(p.x, p.z) <= 1.1) continue;
        if (pavR(p) < PAV_KEEP + 0.5) break;
        return onGround(p);
      }
      fallback ??= new THREE.Vector3(D.x + Math.cos(shoreward) * 12, 0, D.z + Math.sin(shoreward) * 12);
    }
    return onGround(fallback);
  }

  // Dining pavilion (unrotated, floor top at anchors.pavilion.y): a 13m marble platform with a step
  // to 13.9m, 18 columns at r 12.4 every 20°, and 12 radial tables at r 7.8 (6 to 9.6), angle
  // 0.13 + k·30°, their benches 0.73 to 1.18 either side. Walking in a straight line crossed all of
  // that, so campers follow its aisles: through a gap in the colonnade, round the free ring between
  // the tables and the columns, then down the aisle between two tables to the bench.
  const P = anchors.pavilion;
  const PAV_R = 13;
  const PAV_KEEP = PAV_R + 1.3; // walkers from outside keep out of this circle unless it's their goal
  const COL_STEP = Math.PI / 9;
  const pavR = (v) => Math.hypot(v.x - P.x, v.z - P.z);
  const pavA = (v) => Math.atan2(v.z - P.z, v.x - P.x);
  function groundAt(x, z) {
    const r = Math.hypot(x - P.x, z - P.z);
    if (r < PAV_R) return P.y;
    if (r < PAV_R + 0.9) return P.y - 0.2;
    const tier = amphTier(x, z);
    if (tier >= 0) return F.y + 0.45 * (tier + 1);
    return ctx.heightAt(x, z);
  }

  // Campfire amphitheater: five solid stone tiers on the far side of the fire from the camp, each
  // a ring from 4.7 + 1.3t to 6 + 1.3t at height 0.45(t + 1), spanning ±0.4π round that side.
  // Campers come in from the open front, round the fire inside the first tier, then climb an aisle
  // between two seats and step sideways onto theirs.
  const F = anchors.campfire;
  const AMPH_SPREAD = Math.PI * 0.4;
  const fireToCenter = Math.atan2(anchors.green.z - F.z, anchors.green.x - F.x);
  const amphBack = fireToCenter + Math.PI;
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function amphTier(x, z) {
    const r = Math.hypot(x - F.x, z - F.z);
    if (r < 4.7 || r > 11.2) return -1;
    if (Math.abs(wrapA(Math.atan2(z - F.z, x - F.x) - amphBack)) > AMPH_SPREAD) return -1;
    return Math.min(4, Math.floor((r - 4.7) / 1.3));
  }
  const firePoint = (r, a) => new THREE.Vector3(F.x + Math.cos(a) * r, F.y, F.z + Math.sin(a) * r);
  function amphRoute(seatA, seatR, aisleA) {
    // enter on the seat's side of the fire, through the open front
    const side = wrapA(seatA - amphBack) < 0 ? -1 : 1;
    const entryA = fireToCenter - side * Math.PI * 0.35;
    const route = [onGround(firePoint(13, entryA)), onGround(firePoint(3.4, entryA))];
    // round the fire inside the lowest tier, never across it
    const span = wrapA(aisleA - entryA);
    const steps = Math.ceil(Math.abs(span) / 0.35);
    for (let s = 1; s <= steps; s++) route.push(onGround(firePoint(3.4, entryA + (span * s) / steps)));
    // up the aisle to the seat's tier, then along it
    route.push(firePoint(seatR, aisleA));
    return route;
  }
  function pavPoint(r, a) {
    return new THREE.Vector3(P.x + Math.cos(a) * r, P.y, P.z + Math.sin(a) * r);
  }
  // waypoints from outside the colonnade to just behind a bench seat (tableLocal: seat in table frame)
  function pavilionRoutes(table, seatX, side, offerSlot) {
    const behind = new THREE.Vector3(seatX, 0, side * 1.5).applyMatrix4(table.matrixWorld).setY(P.y);
    const aisleA = pavA(table.getWorldPosition(tmp)) + side * (Math.PI / 12);
    const besideSeat = pavPoint(7.8 + seatX, aisleA);
    const outerAisle = pavPoint(10.8, aisleA);
    const innerAisle = pavPoint(4.6, aisleA);
    const gapA = COL_STEP / 2 + Math.round((aisleA - COL_STEP / 2) / COL_STEP) * COL_STEP;
    const gapIn = pavPoint(10.8, gapA);
    const gapOut = onGround(new THREE.Vector3(P.x + Math.cos(gapA) * 15.5, 0, P.z + Math.sin(gapA) * 15.5));
    const offer = pavPoint(1.6, aisleA + (offerSlot - 0.5) * 0.5);
    return {
      in: [gapOut, gapIn, outerAisle, besideSeat, behind],
      offer: [behind, besideSeat, innerAisle],
      back: [innerAisle, besideSeat, behind],
      offerSpot: offer,
    };
  }

  // Free time on the green: everyone wanders, walking to a spot, lingering, then picking another.
  // A waypoint only changes every few seconds (a target that slid along under them every frame
  // flipped campers between walking and standing each frame). Spots are seeded by index and leg
  // number, so seeking or skipping lands on the same ones, and handed out player-first each frame:
  // one that lands within 1.2m of an earlier spot takes its next candidate, so nobody ends up
  // standing inside someone else.
  let wander = null;
  let wanderAt = null;
  function wanderSpot(m, progress) {
    if (wanderAt !== progress || wander?.size !== members.length) {
      wander = new Map();
      wanderAt = progress;
      const taken = [];
      const order = [...members].sort((a, b) => b.isPlayer - a.isPlayer || a.index - b.index);
      for (const x of order) {
        const j = x.index;
        const leg = Math.floor((progress * 60 + x.offerSlot * 9) / (7 + (j % 4) * 1.5));
        let spot = null;
        for (let k = 0; k < 8; k++) {
          const a = hash(j, leg * 8 + k) * Math.PI * 2;
          const r = 4 + Math.sqrt(hash(j + 101, leg * 8 + k)) * 9; // inside the cabin ring
          spot = ringPoint(anchors.green, r, a);
          if (taken.every((t) => t.distanceTo(spot) > 1.2)) break;
        }
        taken.push(spot);
        wander.set(x, spot);
      }
    }
    return wander.get(m);
  }

  // Chat groups: members in player-first order, chunked into threes and twos (never a lone one),
  // each group round its own spot on the green at least 3.2m from the others.
  let chats = null;
  let chatsFor = -1;
  function chatSpot(m) {
    if (chatsFor !== members.length) {
      chats = new Map();
      chatsFor = members.length;
      const order = [...members].sort((a, b) => b.isPlayer - a.isPlayer || a.index - b.index);
      const centers = [];
      for (let n = 0, g = 0; n < order.length; g++) {
        const left = order.length - n;
        const size = left === 3 ? 3 : left === 4 || left === 2 ? 2 : g % 2 ? 2 : 3;
        let center = null;
        for (let k = 0; k < 12; k++) {
          const a = hash(g + 500, k) * Math.PI * 2;
          const r = 4 + Math.sqrt(hash(g + 700, k)) * 9;
          center = ringPoint(anchors.green, r, a);
          if (centers.every((c) => c.distanceTo(center) > 3.2)) break;
        }
        centers.push(center);
        const spin = hash(g + 900, 0) * Math.PI * 2;
        const rad = size === 3 ? 0.75 : 0.6;
        order.slice(n, n + size).forEach((x, s) => {
          chats.set(x, { pos: ringPoint(center, rad, spin + (s / size) * Math.PI * 2), center });
        });
        n += size;
      }
    }
    return chats.get(m);
  }

  // Scatter: archers and fighters head for the spots they'll train at, everyone else splits
  // between the stables and the lake shore by the dock.
  function scatterSpot(m) {
    if (m.role === 'archer' || m.role === 'fighter') {
      const t = targetFor(m, 'training', 0);
      return { pos: t.pos, pose: 'idle', face: t.face };
    }
    return { pos: m.index % 2 ? dockSpot(m.index) : stablesSpot(m.index), pose: 'idle', face: anchors.lake };
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
        // wander, then drift into little groups of two or three to chat, then scatter to the
        // stables, the lake, the archery range and the arena ahead of the training scene
        if (progress < GATHER) return { pos: wanderSpot(m, progress), pose: 'idle' };
        if (progress < SCATTER) {
          const g = chatSpot(m);
          return { pos: g.pos, pose: 'talk', face: g.center };
        }
        return scatterSpot(m);
      }
      case 'training': {
        if (m.role === 'archer') {
          const targets = ctx.archeryTargets;
          // spots go by order among the archers (not the crowd index, which would leave lanes
          // empty and stack two archers on one spot)
          const k = archerRank(m);
          const lane = k % targets.length;
          const tgt = targets[lane];
          // stand on the shooting line, 22m in front of the target
          const mid = targets.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / targets.length);
          const dir = tmp.copy(anchors.archery).sub(mid).setY(0).normalize();
          const slot = Math.floor(k / targets.length) % 3;
          const along = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((slot - 1) * 1.1);
          const pos = tgt.clone().addScaledVector(dir, 22 + slot * 0.4).add(along);
          return { pos: onGround(pos), pose: 'drawBow', face: tgt };
        }
        if (m.role === 'fighter') return arenaSpot(m);
        return { pos: ringPoint(anchors.arena, 15.5, i * 0.7), pose: 'idle', face: anchors.arena };
      }
      case 'pegasus': {
        // a third of camp (the player always among them) watches the flights from the lake shore
        // and the stables; the rest head back to their cabins and stay indoors
        if (i % 3 === 0 || m.isPlayer) {
          const w = i / 3; // compact watcher number, so the spots fill without gaps
          return { pos: w % 2 ? dockSpot(w) : stablesSpot(w), pose: 'idle', face: anchors.lake, lookUp: true };
        }
        return { pos: onGround(door.clone()), pose: 'idle', indoors: true };
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
        const routes = pavilionRoutes(table, seatX, Math.sign(sideZ), m.offerSlot);
        // offering window: each camper visits the brazier once in the first half, once they've sat
        // down (someone still walking in when their window comes skips it)
        const start = 0.12 + m.offerSlot * 0.35;
        if (m.dinnerSeated && progress > start && progress < start + 0.07) {
          return { pos: routes.offerSpot, route: routes.offer, routeKey: 'offer', pose: 'idle', face: anchors.brazier, offering: true };
        }
        const back = m.routeKey === 'offer' || m.routeKey === 'back';
        return { pos: seatPos, route: back ? routes.back : routes.in, routeKey: back ? 'back' : 'in', pose: 'sit', face: across, seated: true };
      }
      case 'campfire':
      default: {
        const row = i % 3;
        const n = Math.ceil(members.length / 3);
        const k = Math.floor(i / 3);
        // seats on the far side of the fire from the camp, on the stone tiers
        const rel = (k / Math.max(n - 1, 1)) - 0.5;
        const a = amphBack + rel * Math.PI * 0.72;
        // sit on the stone tiers (tier k: radius 6 + 1.3k, top at 0.45(k+1))
        const tier = row + 1;
        const r = 6 + tier * 1.3 - 0.45;
        // the aisle runs half a seat over, toward the middle, clear of the seats below this one
        const half = (Math.PI * 0.36) / Math.max(n - 1, 1);
        const aisleA = a + (rel > 0 ? -half : half);
        return {
          pos: ringPoint(F, r, a, 0.45 * (tier + 1) - 0.42),
          route: amphRoute(a, r, aisleA),
          routeKey: 'campfire',
          hub: F,
          pose: 'sit',
          face: F,
          seated: true,
        };
      }
    }
  }

  // Nobody wades: a step that lands in the lake is pushed back out to the shore and slid along
  // it toward the target, so a walk that would cross the water goes round it instead.
  const SHORE = 1.06; // inLake() value of the walkable rim (spots by the dock are all > 1.1)
  const shoreDir = new THREE.Vector3();
  function keepAshore(p, target, step) {
    const v = inLake(p.x, p.z);
    if (v >= SHORE) return;
    const L = LAYOUT.lake;
    const k = Math.sqrt(SHORE / Math.max(v, 1e-4));
    p.x = L.x + (p.x - L.x) * k;
    p.z = L.z + (p.z - L.z) * k;
    shoreDir.set(-(p.z - L.z), 0, p.x - L.x).normalize();
    if (shoreDir.x * (target.x - p.x) + shoreDir.z * (target.z - p.z) < 0) shoreDir.negate();
    p.addScaledVector(shoreDir, step);
  }

  // Same for the pavilion: a walker passing by is held on a circle round it and slides along that
  // toward its goal, instead of cutting across the platform, the tables and the colonnade.
  function keepOffPavilion(p, goal, step) {
    const r = pavR(p);
    if (r >= PAV_KEEP) return;
    const k = PAV_KEEP / Math.max(r, 1e-4);
    p.x = P.x + (p.x - P.x) * k;
    p.z = P.z + (p.z - P.z) * k;
    shoreDir.set(-(p.z - P.z), 0, p.x - P.x).normalize();
    if (shoreDir.x * (goal.x - p.x) + shoreDir.z * (goal.z - p.z) < 0) shoreDir.negate();
    p.addScaledVector(shoreDir, step);
  }

  // a point near `pos` that isn't in the lake, for walking in from off-camera
  function dryNear(pos, a, r) {
    for (let k = 0; k < 12; k++, a += Math.PI / 6) {
      const x = pos.x + Math.cos(a) * r;
      const z = pos.z + Math.sin(a) * r;
      if (inLake(x, z) >= SHORE) return [x, z];
    }
    return [pos.x, pos.z];
  }

  let currentScene = null;

  /** On scene change, members far from their new target start nearby (just off-camera) and walk in. */
  function enterScene(sceneId, progress = 0) {
    currentScene = sceneId;
    for (const m of members) {
      m.routeKey = null;
      m.dinnerSeated = false;
      const t = targetFor(m, sceneId, progress);
      const d = m.mesh.position.distanceTo(t.pos);
      if (t.route && !m.placed) {
        // dropped straight into the scene: already there, nothing left to walk
        m.mesh.position.copy(t.pos);
        m.routeKey = t.routeKey;
        m.routeIdx = t.route.length;
        m.dinnerSeated = !!t.seated;
        m.placed = true;
      } else if (t.route && d > 30) {
        // walk in from just outside the first waypoint (never from inside the building)
        const first = t.route[0];
        const hub = t.hub ?? P;
        const out = Math.atan2(first.z - hub.z, first.x - hub.x) + m.jitter.x * 0.6;
        const [x, z] = dryNear(first, out, 4 + Math.abs(m.jitter.y) * 8);
        m.mesh.position.set(x, ctx.heightAt(x, z), z);
      } else if (t.indoors && (d > 30 || !m.placed)) {
        // already inside: no walk in from off-camera (it could cut through the cabin walls)
        m.mesh.position.copy(t.pos);
        m.placed = true;
      } else if (d > 30 || !m.placed) {
        const a = m.jitter.x * 6.28;
        const r = m.placed ? 10 + Math.abs(m.jitter.y) * 10 : 0;
        const [x, z] = r ? dryNear(t.pos, a, r) : [t.pos.x, t.pos.z];
        m.mesh.position.set(x, 0, z);
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
      // follow the target's waypoints in order, then the target itself
      let goal = t.pos;
      if (t.route) {
        if (m.routeKey !== t.routeKey) {
          m.routeKey = t.routeKey;
          m.routeIdx = 0;
        }
        while (m.routeIdx < t.route.length && Math.hypot(t.route[m.routeIdx].x - p.x, t.route[m.routeIdx].z - p.z) < 0.35) m.routeIdx++;
        if (m.routeIdx < t.route.length) goal = t.route[m.routeIdx];
      } else {
        m.routeKey = null;
      }
      const final = goal === t.pos;
      tmp.copy(goal).sub(p).setY(0);
      const dist = tmp.length();
      // through the door and out of sight; anyone else (and everyone in other scenes) is shown.
      // The player's visibility belongs to the camera (hidden in first person).
      if (!m.isPlayer) m.mesh.visible = !(t.indoors && dist <= 0.25);
      if (!final || dist > 0.25) {
        const speed = dist > 12 ? JOG : WALK;
        tmp.normalize().multiplyScalar(Math.min(speed * dt, dist));
        const wasOut = pavR(p) >= PAV_KEEP;
        p.add(tmp);
        keepAshore(p, goal, tmp.length());
        if (wasOut && pavR(goal) >= PAV_KEEP) keepOffPavilion(p, goal, tmp.length());
        // walk on whatever is underfoot: step straight up onto a stone tier or the pavilion step
        // (easing up lagged with the feet inside the riser), ease down. Sitting down onto a seat
        // happens once arrived, below, so nobody walks along a tier sunk by the sitting drop.
        const ground = groundAt(p.x, p.z);
        p.y = Math.max(ground, THREE.MathUtils.lerp(p.y, ground, 0.3));
        m.mesh.rotation.y = Math.atan2(tmp.x, tmp.z);
        m.mesh.userData.setPose('walk');
        m.mesh.userData.update(dt, dist > 12 ? 1.6 : 1);
      } else {
        p.y = THREE.MathUtils.lerp(p.y, t.pos.y, 0.3);
        if (t.face) m.mesh.rotation.y = Math.atan2(t.face.x - p.x, t.face.z - p.z);
        m.mesh.userData.setAim?.(t.pose === 'drawBow' ? t.face : null);
        m.mesh.userData.setPose(t.pose);
        m.mesh.userData.update(dt);
        if (t.lookUp) m.mesh.userData.head.rotation.x = -0.45;
        if (t.seated && sceneId === 'dinner') m.dinnerSeated = true;
      }
      m.mesh.userData.setArmor?.(!!t.armor);
      m.state = t;
    }
  }

  return { members, addMember, targetFor, update, enterScene };
}
