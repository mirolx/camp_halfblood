import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildWorld } from './world/index.js';

// Free-orbit preview of the world at a fixed time of day (?screen=sim&tod=0.3). Dev only.
export function runDebugView(stage, { tod = 0.3, camera: camPos } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 6000);
  camera.position.set(...(camPos ?? [90, 70, 120]));
  const controls = new OrbitControls(camera, stage.renderer.domElement);
  controls.target.set(10, 0, -10);
  const world = buildWorld(scene, stage.renderer);
  stage.setScene(scene, camera);
  stage.bloom.strength = 0.25;
  stage.bloom.threshold = 0.95;
  let current = tod;
  window.__setTod = (v) => { current = v; };
  window.__cam = camera;
  window.__controls = controls;
  const off = stage.onFrame((dt) => {
    controls.update();
    world.update(dt, current, controls.target);
  });
  return { world, scene, camera, destroy() { off(); controls.dispose(); stage.clear(); } };
}
