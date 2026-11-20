import * as THREE from 'three';
import { buildWorld } from './world/index.js';
import { createCrowd } from './actors/campers.js';
import { createPegasi } from './actors/pegasus.js';
import { createCameras } from './cameras.js';
import { createClock } from './clock.js';
import { createPlayer } from '../three/player.js';
import { sceneProgress, timeOfDayAt } from './timeline.js';

const ARCHER_GODS = ['apollo', 'artemis', 'hermes', 'demeter', 'aphrodite', 'dionysus'];
const FIRE_COLORS = [
  ['#ffd27a', '#ff4a12'], // ordinary orange
  ['#fff0a8', '#ffb21c'], // bright gold as the singing builds
  ['#f2c6ff', '#8a3cff'], // purple at the peak
];

/**
 * Runs the 10-minute day: world, crowd, pegasi, cameras and the clock.
 * The returned API is what the HUD and audio talk to.
 */
export function createDirector(stage, { godId, gender, startAt = 0, audio = null, models = {} }) {
  const scene = new THREE.Scene();
  const home = godId; // Artemis' hunters stay in cabin 8, which is Artemis' cabin
  const world = buildWorld(scene, stage.renderer, { interiorFor: home, models });
  const ctx = {
    heightAt: world.heightAt,
    cabins: world.cabins,
    homeCabin: home,
    ...world.facilities,
  };

  const crowd = createCrowd(scene, ctx, { count: 36 });
  const player = createPlayer(gender, { seed: 1 });
  player.name = 'me';
  scene.add(player);
  const me = crowd.addMember(player, {
    cabinId: home,
    role: ARCHER_GODS.includes(godId) ? 'archer' : 'fighter',
    isPlayer: true,
    index: 0,
  });
  const cab = world.cabins.get(home);
  me.override = (sceneId, p) => {
    if (sceneId !== 'dawn') return null;
    const wa = cab.userData.worldAnchors;
    if (p < 0.4) return { pos: cab.userData.anchors.windowSide.clone().applyMatrix4(cab.matrixWorld), pose: 'idle', face: wa.window.clone().add(wa.window.clone().sub(wa.sound).setY(0).multiplyScalar(3)) };
    // walk out ahead of (and beside) the camera so 'me' never blocks the doorway shot.
    // A fitted interior has real walls: go through the room and the door along the camera's route
    // (from mid-room on, so the camera at the window isn't brushed), not straight through a wall.
    if (p < 0.62) {
      const route = cab.userData.dawnPath?.slice(2).map((v) => v.clone().applyMatrix4(cab.matrixWorld));
      return { pos: new THREE.Vector3(1.8, 0, 11 / 2 + 7.5).applyMatrix4(cab.matrixWorld), pose: 'idle', face: ctx.anchors.green, ...(route && { route, routeKey: 'dawn-out' }) };
    }
    return null;
  };
  for (const m of crowd.members) world.addFill(m.mesh);
  ctx.player = player;
  ctx.playerLookUp = () => (me.state?.lookUp ? 0.5 : 0);

  const pegasi = createPegasi(scene, ctx, { count: 4 });
  ctx.pegasus = pegasi.list[0];
  for (const p of pegasi.list) if (p.userData.rider) world.addFill(p.userData.rider);

  const cameras = createCameras(stage.renderer, ctx);
  if (audio) {
    const A = ctx.anchors;
    for (const k of ['lake', 'pavilion', 'campfire', 'archery', 'arena']) audio.setPosition(k, A[k]);
    audio.setPosition('pegasus', () => pegasi.list[0].position);
  }
  const clock = createClock({ startAt });
  stage.setScene(scene, cameras.camera);

  // place everyone for the starting scene and snap the camera there
  const s0 = clock.scene();
  crowd.enterScene(s0.id, sceneProgress(clock.elapsed()));
  crowd.update(0.016, s0.id, sceneProgress(clock.elapsed()));
  cameras.snap(s0.id, sceneProgress(clock.elapsed()));

  const interior = cab.getObjectByName('interior');
  const homeDoors = cab.userData.doors ?? [];
  const campfire = world.facilities.campfire;
  const brazier = world.facilities.brazierFire;
  const fireA = new THREE.Color();
  const fireB = new THREE.Color();

  const off = stage.onFrame((dt) => {
    clock.tick(dt);
    // paused freezes the world (campers, arrows, pegasi, water, ambience); the camera keeps
    // the real dt so you can still drag to look around a frozen frame
    const simDt = clock.isPaused() ? 0 : dt;
    const t = clock.elapsed();
    const s = clock.scene();
    const p = sceneProgress(t);
    const tod = timeOfDayAt(t);

    crowd.update(simDt, s.id, p);
    pegasi.update(simDt, s.id, p);
    cameras.update(dt, s.id, p);
    const sky = world.update(simDt, tod, cameras.focus());

    // the front door swings open just before we walk out (and stays open for the day)
    const doorOpen = 1.7 * (s.id === 'dawn' ? THREE.MathUtils.smoothstep(p, 0.4, 0.47) : 1);
    for (const d of homeDoors) d.obj.rotation.y = d.sign * doorOpen;

    // cabin lamp only before the camp is fully awake
    if (interior) interior.children.find((c) => c.isPointLight).intensity = s.id === 'dawn' ? 8 : 0;

    // offerings make the brazier flare
    const offering = crowd.members.filter((m) => m.state?.offering && m.mesh.position.distanceTo(ctx.anchors.brazier) < 3).length;
    brazier.setIntensity(1 + offering * 0.35);

    // campfire grows and changes colour with the singing
    if (s.id === 'campfire') {
      const k = p;
      campfire.setIntensity(1 + k * 1.8);
      const seg = Math.min(Math.floor(k * 2), 1);
      const local = k * 2 - seg;
      fireA.set(FIRE_COLORS[seg][0]).lerp(new THREE.Color(FIRE_COLORS[seg + 1][0]), local);
      fireB.set(FIRE_COLORS[seg][1]).lerp(new THREE.Color(FIRE_COLORS[seg + 1][1]), local);
      campfire.setColors(fireA, fireB);
    } else {
      campfire.setIntensity(s.id === 'dinner' ? 0.6 : 0.4);
      campfire.setColors(FIRE_COLORS[0][0], FIRE_COLORS[0][1]);
    }

    // bloom only when it's dark (on a bright HDR sky it washes the frame out)
    const night = THREE.MathUtils.smoothstep(tod, 0.74, 0.86);
    stage.bloom.strength = 0.04 + night * 0.4;
    stage.bloom.threshold = 0.85;

    audio?.update({ sceneId: s.id, progress: p, dt: simDt, camera: cameras.camera });
  });

  return {
    clock,
    cameras,
    world,
    play: () => clock.play(),
    pause: () => clock.pause(),
    isPaused: () => clock.isPaused(),
    elapsed: () => clock.elapsed(),
    skipToNextScene() {
      clock.skipToNextScene();
      const s = clock.scene();
      crowd.enterScene(s.id, 0);
      cameras.snap(s.id, sceneProgress(clock.elapsed()));
    },
    onSceneChange: (fn) => clock.onSceneChange(fn),
    onEnd: (fn) => clock.onEnd(fn),
    destroy() {
      off();
      audio?.stopAll();
      cameras.dispose();
      stage.clear();
    },
  };
}
