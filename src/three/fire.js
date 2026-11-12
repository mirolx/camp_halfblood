import * as THREE from 'three';

// Campfire: logs, additive flame particles, embers and a flickering point light.
const FLAME_VS = `
attribute float aSeed;
uniform float uTime;
uniform float uSize;
uniform float uHeight;
varying float vLife;
varying float vSeed;
void main() {
  float life = fract(uTime * (0.55 + aSeed * 0.5) + aSeed * 7.0);
  vLife = life;
  vSeed = aSeed;
  vec3 p = position;
  float spread = (1.0 - life) * 0.9 + 0.1;
  p.xz *= spread;
  p.x += sin(uTime * 3.0 + aSeed * 20.0) * 0.06 * life;
  p.y += life * uHeight;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (1.0 - life * 0.7) * (300.0 / -mv.z);
}`;

const FLAME_FS = `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vLife;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  vec3 col = mix(uColorA, uColorB, vLife);
  float a = soft * (1.0 - vLife) * 0.85;
  gl_FragColor = vec4(col * (1.6 - vLife), a);
}`;

export function createFire({ scale = 1, count = 220 } = {}) {
  const group = new THREE.Group();
  group.name = 'fire';

  const logMat = new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 7), logMat);
    const a = (i / 6) * Math.PI * 2;
    log.position.set(Math.cos(a) * 0.18, 0.18, Math.sin(a) * 0.18);
    log.rotation.set(0, -a, Math.PI / 2 - 0.55);
    log.rotation.order = 'YZX';
    log.castShadow = true;
    group.add(log);
  }
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#6c665d', roughness: 0.95 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), stoneMat);
    s.position.set(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62);
    s.rotation.set(a, a * 2, 0);
    group.add(s);
  }

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * 0.35;
    const a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, 0.15, Math.sin(a) * r], i * 3);
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: 0.55 },
    uHeight: { value: 1.3 },
    uColorA: { value: new THREE.Color('#ffd27a') },
    uColorB: { value: new THREE.Color('#ff4a12') },
  };
  const flames = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FLAME_VS,
      fragmentShader: FLAME_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  flames.frustumCulled = false;
  group.add(flames);

  const light = new THREE.PointLight('#ff9a4a', 30, 18, 1.6);
  light.position.y = 0.9;
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  group.add(light);

  let intensity = 1;
  const baseLight = 30;
  group.scale.setScalar(scale);

  return {
    group,
    light,
    /** 1 = normal campfire; >1 grows taller and brighter. */
    setIntensity(v) {
      intensity = v;
      uniforms.uHeight.value = 1.3 * v;
      uniforms.uSize.value = 0.55 * Math.sqrt(v);
    },
    setColors(a, b) {
      uniforms.uColorA.value.set(a);
      uniforms.uColorB.value.set(b);
      light.color.set(a).lerp(new THREE.Color(b), 0.5);
    },
    update(t) {
      uniforms.uTime.value = t;
      const flicker = 0.85 + Math.sin(t * 13.1) * 0.06 + Math.sin(t * 7.3) * 0.05 + Math.random() * 0.06;
      light.intensity = baseLight * intensity * flicker;
    },
  };
}
