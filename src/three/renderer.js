import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// One shared WebGL stage. Scenes swap in via setScene; frame callbacks get (dt, elapsed).
// dt is 0 while the tab is hidden so timelines pause naturally.
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.6, 0.85);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let scene = null;
  let camera = null;
  const callbacks = new Set();
  let last = performance.now();
  let elapsed = 0;
  let running = true;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  window.addEventListener('resize', resize);

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    let dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (document.hidden) dt = 0;
    elapsed += dt;
    for (const fn of [...callbacks]) fn(dt, elapsed);
    if (scene && camera) composer.render();
  }
  requestAnimationFrame(frame);

  return {
    renderer,
    bloom,
    setScene(s, c) {
      scene = s;
      camera = c;
      renderPass.scene = s;
      renderPass.camera = c;
      resize();
    },
    setCamera(c) {
      camera = c;
      renderPass.camera = c;
      resize();
    },
    onFrame(fn) {
      callbacks.add(fn);
      return () => callbacks.delete(fn);
    },
    clear() {
      callbacks.clear();
      scene = null;
      camera = null;
      renderer.clear();
    },
    dispose() {
      running = false;
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
