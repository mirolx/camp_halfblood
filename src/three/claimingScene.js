import * as THREE from 'three';
import { createPlayer } from './player.js';
import { createSymbol } from './symbols.js';
import { createFire } from './fire.js';
import { getGod } from '../quiz/gods.js';
import { h, bindI18n } from '../ui/dom.js';

function starField(count = 1500, radius = 120) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random() * 0.9 + 0.1;
    const th = u * Math.PI * 2;
    const ph = Math.acos(v);
    pos.set([Math.sin(ph) * Math.cos(th) * radius, Math.cos(ph) * radius, Math.sin(ph) * Math.sin(th) * radius], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe6ff', size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
}

/**
 * Night campfire; the player stands with their back to us and the god's symbol rises over their head.
 * @returns {{ destroy(): void }}
 */
export function runClaiming(stage, uiRoot, { godId, gender, onContinue, onSymbolRise, startAt = 0 }) {
  const god = getGod(godId);
  const isHunter = godId === 'artemis';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070b16');
  scene.fog = new THREE.FogExp2('#070b16', 0.045);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  camera.position.set(0.6, 1.7, 9.2);

  scene.add(new THREE.HemisphereLight('#2a3a66', '#0a0806', 0.35));
  const moon = new THREE.DirectionalLight(isHunter ? '#cfe0ff' : '#7f95c9', isHunter ? 1.4 : 0.35);
  moon.position.set(-10, 18, -8);
  scene.add(moon);
  scene.add(starField());
  // soft cool fill from behind the camera so the player's back reads as a figure, not a void
  const fill = new THREE.DirectionalLight('#8fa6d8', 0.9);
  fill.position.set(2, 4, 14);
  scene.add(fill);
  const rim = new THREE.PointLight('#ffb070', 6, 6, 2);
  rim.position.set(0, 2.4, 4.2);
  scene.add(rim);

  const moonDisk = new THREE.Mesh(
    new THREE.SphereGeometry(isHunter ? 4 : 2.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: isHunter ? '#eef3ff' : '#cfd6e6', fog: false }),
  );
  moonDisk.position.set(-40, 38, -90);
  scene.add(moonDisk);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshStandardMaterial({ color: '#1d2416', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // amphitheater stone steps
  const stone = new THREE.MeshStandardMaterial({ color: '#5d574d', roughness: 0.95 });
  for (let r = 0; r < 3; r++) {
    const radius = 5.3 + r * 1.1;
    const height = 0.4 * (r + 1);
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 48, 1, false, Math.PI * 0.55, Math.PI * 0.9),
      stone,
    );
    step.position.y = height / 2;
    step.receiveShadow = true;
    scene.add(step);
  }

  const fire = createFire({ scale: 1.2 });
  scene.add(fire.group);

  // log benches + seated campers around the fire (far side)
  const benchMat = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.2 + i * 0.2) + Math.PI;
    const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 10), benchMat);
    bench.rotation.z = Math.PI / 2;
    bench.position.set(Math.cos(a) * 4.15, 0.22, Math.sin(a) * 4.15);
    bench.rotation.y = -a + Math.PI / 2;
    bench.rotation.order = 'YXZ';
    bench.castShadow = true;
    scene.add(bench);
  }
  const campers = [];
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (0.12 + (i / 10) * 0.76) + Math.PI;
    const c = createPlayer(i % 2 ? 'male' : 'female', { seed: i + 3 });
    c.position.set(Math.cos(a) * 4.0, 0, Math.sin(a) * 4.0);
    c.lookAt(0, 0, 0);
    c.userData.setPose('sit');
    scene.add(c);
    campers.push(c);
  }

  const player = createPlayer(gender, { seed: 1 });
  player.position.set(0, 0, 5.4);
  player.lookAt(0, 0, 0);
  scene.add(player);

  const symbol = createSymbol(godId);
  symbol.position.set(0, 1.75, 5.4);
  symbol.scale.setScalar(0.001);
  scene.add(symbol);
  const symbolLight = new THREE.PointLight(god.symbolColor, 0, 8, 1.5);
  symbolLight.position.copy(symbol.position);
  scene.add(symbolLight);

  // overlay
  const title = h('p', { cls: 'claim-kicker', text: isHunter ? 'claim.hunter' : 'claim.kicker' });
  const name = h('h2', { cls: 'claim-name', text: god.nameKey });
  const sub = h('p', { cls: 'claim-title', text: god.titleKey });
  const desc = h('p', { cls: 'claim-desc', text: god.descKey });
  const btn = h('button', { cls: 'start-button claim-continue', text: 'claim.continue', attrs: { type: 'button' } });
  btn.addEventListener('click', () => onContinue());
  const overlay = h('section', { cls: 'claim-overlay' }, [title, name, sub, desc, btn]);
  overlay.style.setProperty('--god', god.symbolColor);
  const offI18n = bindI18n(overlay);
  uiRoot.appendChild(overlay);

  stage.setScene(scene, camera);
  stage.bloom.strength = 0.7;
  stage.bloom.threshold = 0.9;

  const RISE_AT = 3.0;
  let t = startAt;
  let rose = false;
  const off = stage.onFrame((dt) => {
    t += dt;
    window.__claimT = t;
    fire.update(t);
    for (const c of campers) c.userData.update(dt);
    player.userData.update(dt);
    // slow push-in toward the player's back
    const k = Math.min(t / 7, 1);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.set(0.6 - e * 0.3, 1.9 + e * 0.5, 13.0 - e * 1.6);
    camera.lookAt(0, 0.55 + e * 0.1, 4.0);

    if (t > RISE_AT) {
      if (!rose) { rose = true; onSymbolRise?.(); }
      const r = Math.min((t - RISE_AT) / 2.5, 1);
      const er = 1 - Math.pow(1 - r, 3);
      symbol.scale.setScalar(0.001 + er * 0.7);
      symbol.position.y = 1.75 + er * 0.55 + Math.sin(t * 1.4) * 0.03;
      symbol.rotation.y = Math.sin(t * 0.8) * 0.4;
      symbol.userData.material.emissiveIntensity = 0.75 + Math.sin(t * 2.2) * 0.2;
      symbolLight.intensity = er * 4;
      symbolLight.position.y = symbol.position.y;
    }
    if (t > RISE_AT + 2.2) overlay.classList.add('show');
  });

  return {
    destroy() {
      off();
      offI18n();
      overlay.remove();
      stage.clear();
    },
  };
}
