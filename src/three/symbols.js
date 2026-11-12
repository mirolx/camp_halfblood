import * as THREE from 'three';
import { getGod } from '../quiz/gods.js';

// Glowing claiming symbols (~0.6m tall), built from primitives.

function glow(color, intensity = 2.2) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 1,
  });
}

function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

function extrude(points, m, depth = 0.04) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
  geo.center();
  return new THREE.Mesh(geo, m);
}

const BUILDERS = {
  zeus(m) {
    return [extrude([[0.05, 0.32], [-0.12, 0.0], [0.0, 0.0], [-0.08, -0.32], [0.14, 0.06], [0.02, 0.06], [0.12, 0.32]], m)];
  },
  poseidon(m) {
    const parts = [mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), m, 0, -0.08)];
    parts.push(mesh(new THREE.BoxGeometry(0.24, 0.025, 0.025), m, 0, 0.2));
    for (const x of [-0.11, 0, 0.11]) {
      parts.push(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), m, x, 0.27));
      parts.push(mesh(new THREE.ConeGeometry(0.028, 0.07, 8), m, x, 0.36));
    }
    return parts;
  },
  demeter(m) {
    const parts = [mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.6, 6), m, 0, -0.06)];
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const g = mesh(new THREE.SphereGeometry(0.03, 8, 6), m, side * 0.035, 0.05 + i * 0.045);
        g.scale.set(0.7, 1.4, 0.7);
        g.rotation.z = side * -0.4;
        parts.push(g);
      }
    }
    parts.push(mesh(new THREE.ConeGeometry(0.02, 0.08, 6), m, 0, 0.37));
    return parts;
  },
  ares(m) {
    return [
      mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 8), m, 0, -0.08),
      mesh(new THREE.ConeGeometry(0.05, 0.2, 4), m, 0, 0.3),
      mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), m, 0, 0.19),
    ];
  },
  athena(m) {
    const body = mesh(new THREE.SphereGeometry(0.15, 18, 14), m, 0, -0.05);
    body.scale.set(0.9, 1.2, 0.7);
    const head = mesh(new THREE.SphereGeometry(0.11, 18, 14), m, 0, 0.17);
    const parts = [body, head];
    for (const s of [-1, 1]) {
      parts.push(mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20), m, s * 0.048, 0.18, 0.1));
      const tuft = mesh(new THREE.ConeGeometry(0.03, 0.08, 6), m, s * 0.08, 0.28);
      tuft.rotation.z = s * -0.4;
      parts.push(tuft);
    }
    parts.push(mesh(new THREE.ConeGeometry(0.02, 0.05, 6), m, 0, 0.14, 0.11));
    return parts;
  },
  apollo(m) {
    const parts = [mesh(new THREE.SphereGeometry(0.12, 24, 16), m)];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ray = mesh(new THREE.ConeGeometry(0.025, 0.12, 6), m, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
      ray.rotation.z = a - Math.PI / 2;
      parts.push(ray);
    }
    return parts;
  },
  artemis(m) {
    const moon = new THREE.Shape();
    moon.absarc(0, 0, 0.22, Math.PI * 0.35, Math.PI * 1.65, false);
    moon.absarc(0.09, 0, 0.18, Math.PI * 1.55, Math.PI * 0.45, true);
    const geo = new THREE.ExtrudeGeometry(moon, { depth: 0.04, bevelEnabled: false });
    geo.center();
    const crescent = new THREE.Mesh(geo, m);
    crescent.position.x = -0.04;
    const bow = mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 32, Math.PI * 0.7), m, 0.1, 0);
    bow.rotation.z = -Math.PI * 0.35;
    const string = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.5, 4), m, 0.15, 0);
    return [crescent, bow, string];
  },
  hephaestus(m) {
    const handle = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.5, 8), m, 0, -0.08);
    const headM = mesh(new THREE.BoxGeometry(0.26, 0.1, 0.1), m, 0, 0.2);
    const anvil = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.12), m, 0, -0.36);
    return [handle, headM, anvil];
  },
  aphrodite(m) {
    const body = mesh(new THREE.SphereGeometry(0.1, 16, 12), m);
    body.scale.set(1.6, 0.9, 0.8);
    const head = mesh(new THREE.SphereGeometry(0.06, 14, 10), m, 0.17, 0.07);
    const beak = mesh(new THREE.ConeGeometry(0.018, 0.05, 6), m, 0.24, 0.07);
    beak.rotation.z = -Math.PI / 2;
    const parts = [body, head, beak];
    for (const s of [-1, 1]) {
      const wing = extrude([[0, 0], [-0.12, 0.28], [-0.22, 0.24], [-0.16, 0.02]], m, 0.015);
      wing.position.set(-0.04, 0.14, s * 0.05);
      wing.rotation.x = s * 0.35;
      parts.push(wing);
    }
    const tail = extrude([[0, 0], [-0.14, 0.06], [-0.14, -0.06]], m, 0.015);
    tail.position.set(-0.2, 0, 0);
    parts.push(tail);
    return parts;
  },
  hermes(m) {
    const parts = [mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), m, 0, -0.04)];
    for (const phase of [0, Math.PI]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = phase + t * Math.PI * 4;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.06, -0.3 + t * 0.5, Math.sin(a) * 0.06));
      }
      parts.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.012, 6), m));
    }
    for (const s of [-1, 1]) {
      const wing = extrude([[0, 0], [s * 0.16, 0.06], [s * 0.13, -0.02], [s * 0.1, -0.04]], m, 0.012);
      wing.position.set(s * 0.07, 0.24, 0);
      parts.push(wing);
    }
    parts.push(mesh(new THREE.SphereGeometry(0.03, 10, 8), m, 0, 0.28));
    return parts;
  },
  dionysus(m) {
    const parts = [];
    const rows = [4, 3, 3, 2, 1];
    rows.forEach((n, r) => {
      for (let i = 0; i < n; i++) {
        parts.push(mesh(new THREE.SphereGeometry(0.04, 10, 8), m, (i - (n - 1) / 2) * 0.075, 0.1 - r * 0.07, (r % 2) * 0.02));
      }
    });
    const leaf = extrude([[0, 0], [0.12, 0.08], [0.2, 0.02], [0.16, -0.06], [0.06, -0.04]], m, 0.012);
    leaf.position.set(0.05, 0.22, 0);
    parts.push(leaf);
    parts.push(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), m, 0, 0.2));
    return parts;
  },
};

export function createSymbol(godId) {
  const god = getGod(godId); // throws for hera / unknown
  const m = glow(god.symbolColor);
  const group = new THREE.Group();
  group.name = `symbol-${godId}`;
  for (const p of BUILDERS[godId](m)) group.add(p);
  group.userData.material = m;
  return group;
}
