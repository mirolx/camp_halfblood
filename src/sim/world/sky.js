import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// Time of day (tod 0..1: 5:30 dawn → 22:00 night) drives sun, sky, fog, light and stars.
// Keyframes: [tod, sunElevationDeg, sunIntensity, hemiIntensity, exposure, fogColor, fogDensity, starOpacity]
const KEYS = [
  [0.0, 4.5, 0.9, 0.4, 0.7, '#d6c2bb', 0.0042, 0.0],
  [0.06, 9, 1.8, 0.5, 0.6, '#dcc8b4', 0.003, 0.0],
  [0.15, 18, 2.4, 0.6, 0.5, '#b9cde0', 0.0016, 0],
  [0.45, 58, 3.0, 0.6, 0.45, '#b4cbe4', 0.0011, 0],
  [0.6, 32, 2.8, 0.6, 0.47, '#c4ccd6', 0.0013, 0],
  [0.72, 6, 1.8, 0.45, 0.6, '#d89a6c', 0.0022, 0],
  [0.79, -2, 0.25, 0.3, 0.7, '#5d4f6e', 0.005, 0.2],
  [0.86, -14, 0.0, 0.3, 1.1, '#1a2340', 0.006, 0.8],
  [1.0, -25, 0.0, 0.3, 1.2, '#141c34', 0.006, 1],
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function sample(tod) {
  let i = 0;
  while (i < KEYS.length - 2 && tod > KEYS[i + 1][0]) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = THREE.MathUtils.clamp((tod - a[0]) / (b[0] - a[0]), 0, 1);
  const lerp = (j) => a[j] + (b[j] - a[j]) * k;
  tmpA.set(a[5]);
  tmpB.set(b[5]);
  return {
    elevation: lerp(1),
    sun: lerp(2),
    hemi: lerp(3),
    exposure: lerp(4),
    fog: tmpA.clone().lerp(tmpB, k),
    fogDensity: lerp(6),
    stars: lerp(7),
  };
}

function sunColorFor(elev) {
  // warm near the horizon, white overhead
  const k = THREE.MathUtils.smoothstep(elev, -2, 25);
  return new THREE.Color('#ff9a52').lerp(new THREE.Color('#fff6e8'), k);
}

export function createSky(scene, renderer) {
  const sky = new Sky();
  sky.scale.setScalar(4500);
  scene.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = 3;
  u.rayleigh.value = 1.2;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.82;

  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 500;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight('#8ea6e0', 0);
  moon.position.set(-80, 120, 60);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight('#bcd4ff', '#4a5a2a', 0.6);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2('#c9d6e3', 0.003);
  scene.background = new THREE.Color('#141c34');

  // stars + moon disk for the night
  const starGeo = new THREE.BufferGeometry();
  const N = 2500;
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 0.95 + 0.05);
    p.set([Math.sin(ph) * Math.cos(th) * 1500, Math.cos(ph) * 1500, Math.sin(ph) * Math.sin(th) * 1500], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: '#e6ecff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
  );
  scene.add(stars);
  const moonDisk = new THREE.Mesh(
    new THREE.SphereGeometry(28, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#eef2ff', fog: false, transparent: true, opacity: 0 }),
  );
  moonDisk.position.set(-700, 900, 500);
  scene.add(moonDisk);

  const sunDir = new THREE.Vector3();
  const state = { tod: 0, sunDir, sunColor: new THREE.Color(), isNight: false };

  function update(tod, focus = new THREE.Vector3()) {
    const s = sample(tod);
    // sun rises in the east (+x), sets west (-x), arcing slightly south (+z)
    const azimuth = THREE.MathUtils.lerp(-0.15 * Math.PI, 1.15 * Math.PI, tod) ;
    const phi = THREE.MathUtils.degToRad(90 - s.elevation);
    sunDir.setFromSphericalCoords(1, phi, azimuth + Math.PI / 2);
    u.sunPosition.value.copy(sunDir);

    sun.position.copy(focus).addScaledVector(sunDir, 200);
    sun.target.position.copy(focus);
    sun.intensity = s.sun;
    sun.color.copy(sunColorFor(s.elevation));
    hemi.intensity = s.hemi;
    hemi.color.set(s.elevation > 0 ? '#bcd4ff' : '#5a6fa8');
    moon.intensity = s.stars * 1.1;

    scene.fog.color.copy(s.fog);
    scene.background.copy(s.fog);
    scene.fog.density = s.fogDensity;
    renderer.toneMappingExposure = s.exposure;

    stars.material.opacity = s.stars;
    moonDisk.material.opacity = s.stars;
    sky.visible = s.stars < 0.95;

    state.tod = tod;
    state.sunColor.copy(sun.color);
    state.isNight = s.stars > 0.5;
    return state;
  }

  return { update, state, sun, hemi, moon };
}
