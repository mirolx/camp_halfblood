import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { std, box, cyl, sphere, column, wall, gableRoof, textPlane } from './kit.js';

export const CABIN_IDS = ['zeus', 'hera', 'poseidon', 'demeter', 'ares', 'athena', 'apollo', 'artemis', 'hephaestus', 'aphrodite', 'hermes', 'dionysus'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const W = 8; // width (x)
const D = 11; // depth (z); front faces +z
const H = 3.4; // wall height
const T = 0.25; // wall thickness

// Look per cabin (spec §5 "캐빈별 디자인").
const STYLES = {
  zeus: { wall: std('#eeeae0', { rough: 0.35 }), roof: std('#d9d4c6', { rough: 0.4 }), trim: std('#b8893a', { rough: 0.3, metal: 0.8 }), door: std('#a8742a', { rough: 0.3, metal: 0.9 }), columns: 4, scale: 1.15, roofRise: 1.6 },
  hera: { wall: std('#f4f1ea', { rough: 0.4 }), roof: std('#2f6f7a', { rough: 0.5 }), trim: std('#3a8fa0'), door: std('#efe8d8'), columns: 4, roofRise: 1.6 },
  poseidon: { wall: std('#7c8a8c', { rough: 0.95 }), roof: std('#4c6466', { rough: 0.8 }), trim: std('#5fa7a3'), door: std('#3e6f73'), columns: 0, roofRise: 0.8, height: 2.8 },
  demeter: { wall: std('#a3825a'), roof: std('#5f8a32', { rough: 1 }), trim: std('#7a5a36'), door: std('#6a4a2a'), columns: 0, roofRise: 1.3 },
  ares: { wall: std('#9b2b22', { rough: 0.95 }), roof: std('#4a1612'), trim: std('#3a2a26'), door: std('#2e2522'), columns: 0, roofRise: 1.0 },
  athena: { wall: std('#a7adb4', { rough: 0.6 }), roof: std('#6d737a'), trim: std('#d7dbe0'), door: std('#5a5f66'), columns: 2, roofRise: 1.4 },
  apollo: { wall: std('#e2b543', { rough: 0.25, metal: 0.85 }), roof: std('#c99a2a', { rough: 0.3, metal: 0.8 }), trim: std('#fff2c0', { rough: 0.3, metal: 0.6 }), door: std('#b07a1a', { metal: 0.7, rough: 0.3 }), columns: 2, roofRise: 1.4 },
  artemis: { wall: std('#c9ced6', { rough: 0.3, metal: 0.75, emissive: '#9fb8ff', emissiveIntensity: 0 }), roof: std('#aab3c0', { rough: 0.3, metal: 0.8 }), trim: std('#e8eef8', { metal: 0.6, rough: 0.3 }), door: std('#8d97a6', { metal: 0.6, rough: 0.4 }), columns: 0, roofRise: 1.2 },
  hephaestus: { wall: std('#6b5b4b', { rough: 0.9 }), roof: std('#3d3a36', { rough: 0.7, metal: 0.4 }), trim: std('#b08d57', { rough: 0.35, metal: 0.85 }), door: std('#4a3f35', { metal: 0.5 }), columns: 0, roofRise: 0.9 },
  aphrodite: { wall: std('#eaa7b8'), roof: std('#f4dfe5'), trim: std('#ffffff'), door: std('#f6f0f2'), columns: 2, roofRise: 1.4 },
  hermes: { wall: std('#8a6a4a', { rough: 1 }), roof: std('#5a4636', { rough: 1 }), trim: std('#6d553f'), door: std('#5a4636'), columns: 0, roofRise: 1.1, sag: true },
  dionysus: { wall: std('#6d3f7a'), roof: std('#4a2a55'), trim: std('#c58bff'), door: std('#3d2246'), columns: 0, roofRise: 1.2 },
};

const LEAF = std('#4f7a2c', { rough: 0.9 });

function addExteriorDetails(id, g, s, h) {
  const front = D / 2;
  switch (id) {
    case 'zeus': {
      // bronze lightning medallion over the door
      const bolt = box(0.15, 1.0, 0.1, s.trim, 0, h + 0.6, front + 1.6, g);
      bolt.rotation.z = 0.5;
      break;
    }
    case 'hera':
      for (let i = 0; i < 5; i++) {
        const f = sphere(0.18, std('#2c8f8a', { rough: 0.4 }), -1.2 + i * 0.6, h + 0.5, front + 1.6, g, 10);
        f.scale.set(0.6, 1.4, 0.3);
      }
      break;
    case 'poseidon':
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? 1 : -1;
        const sh = sphere(0.09 + (i % 3) * 0.03, i % 4 ? std('#f1e3cf', { rough: 0.5 }) : std('#e98a76'), side * (W / 2 + 0.13), 0.4 + ((i * 0.37) % 2.1), -D / 2 + 0.8 + ((i * 1.7) % (D - 1.6)), g, 8);
        sh.scale.set(0.5, 1, 1);
      }
      break;
    case 'demeter':
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const v = box(0.12, 2.2 + (i % 2) * 0.6, 0.6, LEAF, side * (W / 2 + 0.12), 1.2, -D / 2 + 1 + i * 1.8, g);
          v.castShadow = false;
          sphere(0.08, std('#d9342b'), side * (W / 2 + 0.2), 1.0 + (i % 3) * 0.5, -D / 2 + 1.2 + i * 1.8, g, 8);
        }
      }
      for (let i = 0; i < 4; i++) box(0.9, 0.25, 0.35, std('#7a5a36'), -2.6 + i * 1.75, 0.6, front + 0.3, g);
      break;
    case 'ares': {
      // barbed wire along the ridge
      for (let i = 0; i < 18; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 4, 10), std('#6b6b6b', { metal: 0.8, rough: 0.5 }));
        ring.position.set(0, h + s.roofRise + 0.15, -D / 2 - 0.4 + i * 0.7);
        ring.rotation.y = Math.PI / 2;
        g.add(ring);
      }
      // boar head over the door
      const head = sphere(0.45, std('#3a2a22'), 0, h + 0.5, front + 0.2, g);
      head.scale.set(1, 0.8, 1.2);
      sphere(0.2, std('#2a1d18'), 0, h + 0.4, front + 0.65, g);
      for (const sx of [-1, 1]) {
        const tusk = cyl(0.03, 0.06, 0.4, std('#efe6d2'), sx * 0.25, h + 0.25, front + 0.6, g, 6);
        tusk.rotation.x = -0.9;
      }
      break;
    }
    case 'athena': {
      const body = sphere(0.35, std('#d7dbe0', { rough: 0.5 }), 0, h + 0.55, front + 0.2, g);
      body.scale.set(1, 1.1, 0.6);
      for (const sx of [-1, 1]) sphere(0.1, std('#4a4f55'), sx * 0.13, h + 0.7, front + 0.4, g, 8);
      break;
    }
    case 'apollo':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI;
        const ray = box(0.08, 0.7, 0.06, s.trim, Math.cos(a) * 0.9, h + 0.5 + Math.sin(a) * 0.6, front + 1.6, g);
        ray.rotation.z = a - Math.PI / 2;
      }
      break;
    case 'artemis':
      break;
    case 'hephaestus':
      for (const z of [-2.5, 2]) {
        cyl(0.35, 0.4, 3.6, std('#3a3430', { metal: 0.5, rough: 0.6 }), W / 2 - 1.2, h + 1.5, z, g);
        cyl(0.42, 0.42, 0.25, s.trim, W / 2 - 1.2, h + 3.3, z, g);
      }
      for (let i = 0; i < 3; i++) {
        const gear = new THREE.Mesh(new THREE.TorusGeometry(0.4 + i * 0.12, 0.08, 6, 12), s.trim);
        gear.position.set(-1.6 + i * 1.6, h - 0.8, front + 0.16);
        g.add(gear);
      }
      break;
    case 'aphrodite':
      for (let i = 0; i < 4; i++) {
        const x = -2.7 + i * 1.8;
        box(1.0, 0.3, 0.4, s.trim, x, 1.35, front + 0.25, g);
        for (let k = 0; k < 3; k++) sphere(0.12, std(k % 2 ? '#e8476b' : '#ff9ec0'), x - 0.3 + k * 0.3, 1.6, front + 0.3, g, 8);
      }
      break;
    case 'hermes':
      // patched planks
      for (let i = 0; i < 5; i++) box(1.2, 0.25, 0.05, std('#a07d58'), -2.5 + i * 1.3, 0.6 + (i % 3) * 0.9, front + 0.14, g).rotation.z = (i % 2 ? 1 : -1) * 0.08;
      break;
    case 'dionysus':
      for (let i = 0; i < 40; i++) {
        const side = i % 3 === 0 ? 0 : i % 3 === 1 ? -1 : 1;
        const x = side === 0 ? -3.6 + ((i * 0.53) % 7.2) : side * (W / 2 + 0.15);
        const z = side === 0 ? front + 0.15 : -D / 2 + ((i * 0.77) % D);
        const leaf = sphere(0.28, LEAF, x, 0.6 + ((i * 0.41) % 2.6), z, g, 6);
        leaf.scale.set(1, 0.7, 0.5);
        if (i % 5 === 0) sphere(0.1, std('#5b2a6e'), x, 0.4 + ((i * 0.41) % 2.6), z + 0.1, g, 8);
      }
      break;
    default:
      break;
  }
}

const BED_FRAME = std('#5a4130');
const BLANKET = std('#c9b48d', { rough: 1 });
const PILLOW = std('#f2ece0', { rough: 1 });

function bunk(x, z, parent, rot = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  for (const y of [0.45, 1.6]) {
    box(1.0, 0.12, 2.0, BED_FRAME, 0, y, 0, g);
    box(0.92, 0.12, 1.9, BLANKET, 0, y + 0.12, 0, g);
    box(0.6, 0.1, 0.35, PILLOW, 0, y + 0.22, -0.75, g);
  }
  for (const sx of [-0.48, 0.48]) for (const sz of [-0.95, 0.95]) box(0.08, 2.0, 0.08, BED_FRAME, sx, 1.0, sz, g);
  parent.add(g);
  return g;
}

function addInteriorProps(id, g, s, h) {
  const back = -D / 2 + T;
  switch (id) {
    case 'zeus': {
      const st = std('#f4f1ea', { rough: 0.3 });
      cyl(0.6, 0.7, 0.6, st, 0, 0.3, back + 1.6, g);
      cyl(0.45, 0.55, 2.4, st, 0, 1.8, back + 1.6, g);
      sphere(0.35, st, 0, 3.25, back + 1.6, g);
      break;
    }
    case 'poseidon': {
      cyl(0.8, 0.6, 0.6, std('#7c8a8c'), 0, 0.3, back + 1, g);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), std('#2f8a9a', { rough: 0.1, metal: 0.2, emissive: '#1a5a6a', emissiveIntensity: 0.4 }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, 0.61, back + 1);
      g.add(water);
      break;
    }
    case 'demeter':
      for (let i = 0; i < 5; i++) {
        cyl(0.18, 0.13, 0.3, std('#a8623a'), -2 + i, 0.15, back + 0.5, g);
        sphere(0.3, LEAF, -2 + i, 0.55, back + 0.5, g, 8);
      }
      break;
    case 'ares':
      for (let i = 0; i < 5; i++) {
        const sp = cyl(0.025, 0.025, 2.4, std('#5a5a5a', { metal: 0.8 }), 2.0 + i * 0.35, 1.3, back + 0.3, g, 6);
        sp.rotation.x = 0.1;
      }
      break;
    case 'athena':
      for (const x of [-2.4, 2.4]) {
        box(1.4, 2.6, 0.4, std('#5a4130'), x, 1.3, back + 0.25, g);
        for (let r = 0; r < 4; r++) box(1.2, 0.35, 0.3, std(['#7a3a2a', '#2a4a6a', '#5a6a3a', '#8a6a3a'][r]), x, 0.4 + r * 0.6, back + 0.3, g);
      }
      box(2.0, 0.08, 1.0, std('#6a4a30'), 0, 0.9, back + 1.5, g);
      box(1.6, 0.01, 0.8, std('#e8dcb8'), 0, 0.95, back + 1.5, g);
      break;
    case 'apollo': {
      const lyre = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 6, 16, Math.PI), s.trim);
      lyre.position.set(2.7, 1.8, back + 0.2);
      lyre.rotation.z = Math.PI;
      g.add(lyre);
      break;
    }
    case 'artemis': {
      for (let i = 0; i < 3; i++) {
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 5, 20, Math.PI * 0.8), s.trim);
        bow.position.set(i === 1 ? 3.0 : -3.0, 1.8 - (i === 2 ? 0.6 : 0), back + 0.15);
        bow.rotation.z = Math.PI * 0.6;
        g.add(bow);
      }
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), std('#9aa0a8', { rough: 1 }));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.02, 0);
      g.add(rug);
      break;
    }
    case 'hephaestus':
      box(1.6, 0.9, 1.0, std('#4a3f35'), -2.6, 0.45, back + 0.7, g);
      for (let i = 0; i < 3; i++) {
        const gear = new THREE.Mesh(new THREE.TorusGeometry(0.2 + i * 0.05, 0.05, 6, 10), s.trim);
        gear.position.set(-3.1 + i * 0.5, 1.0, back + 0.7);
        gear.rotation.x = Math.PI / 2;
        g.add(gear);
      }
      break;
    case 'aphrodite':
      box(1.0, 2.0, 0.08, std('#dfe6ee', { metal: 1, rough: 0.05 }), -2.9, 1.4, back + 0.1, g);
      box(1.6, 2.4, 0.6, std('#f6f0f2'), 2.2, 1.2, back + 0.35, g);
      break;
    case 'hermes':
      for (let i = 0; i < 6; i++) {
        const bag = cyl(0.25, 0.25, 1.8, std(['#3a6a8a', '#8a3a3a', '#3a7a4a'][i % 3], { rough: 1 }), -2.4 + i * 0.95, 0.15, 0.5, g, 8);
        bag.rotation.x = Math.PI / 2;
      }
      break;
    case 'dionysus':
      for (let i = 0; i < 12; i++) sphere(0.25, LEAF, -3 + (i % 6) * 1.2, h - 0.3, back + 0.2 + Math.floor(i / 6) * 0.3, g, 6);
      cyl(0.4, 0.25, 0.2, std('#c9a24a', { metal: 0.6, rough: 0.4 }), 0, 0.95, back + 1.4, g);
      for (let i = 0; i < 6; i++) sphere(0.07, std('#5b2a6e'), -0.15 + (i % 3) * 0.15, 1.1 + Math.floor(i / 3) * 0.1, back + 1.4, g, 8);
      box(1.4, 0.06, 1.0, std('#6a4a30'), 0, 0.85, back + 1.4, g);
      break;
    default:
      break;
  }
}

/** One cabin. Local frame: centered at origin, front (door) faces +z, floor at y=0. */
export function buildCabin(id, { interior = false } = {}) {
  const s = STYLES[id];
  if (!s) throw new Error(`Unknown cabin: ${id}`);
  const h = s.height ?? H;
  const g = new THREE.Group();
  g.name = `cabin-${id}`;

  // footprint marker (used for layout overlap checks)
  const fp = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.05, D + 0.6), std('#7a6a55'));
  fp.name = 'footprint';
  fp.position.y = 0.02;
  fp.receiveShadow = true;
  g.add(fp);

  // floor + walls with openings
  box(W, 0.2, D, std('#8a6a4a'), 0, 0.1, 0, g);
  const front = wall(W, h, T, s.wall, [{ x: 0, w: 1.4, y0: 0, y1: 2.4 }, { x: -2.5, w: 1.2, y0: 1.1, y1: 2.3 }, { x: 2.5, w: 1.2, y0: 1.1, y1: 2.3 }], g);
  front.position.z = D / 2 - T / 2;
  // the home cabin gets a big picture window at the back (the dawn shot looks out of it)
  const backWin = interior ? { x: 0, w: 3.4, y0: 0.75, y1: 2.85 } : { x: 0, w: 2.2, y0: 1.0, y1: 2.5 };
  const backWall = wall(W, h, T, s.wall, [backWin], g);
  backWall.position.z = -D / 2 + T / 2;
  for (const side of [-1, 1]) {
    const sw = wall(D - T * 2, h, T, s.wall, [{ x: -2, w: 1.4, y0: 1.1, y1: 2.3 }, { x: 2, w: 1.4, y0: 1.1, y1: 2.3 }], g);
    sw.rotation.y = Math.PI / 2;
    sw.position.x = side * (W / 2 - T / 2);
  }
  // gable infill + roof
  const gable = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(0, s.roofRise), new THREE.Vector2(W / 2, 0)]);
  for (const z of [D / 2 - T / 2, -D / 2 + T / 2]) {
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), s.wall);
    gm.material.side = THREE.DoubleSide;
    gm.position.set(0, h, z);
    g.add(gm);
  }
  const roof = gableRoof(W, D, s.roofRise, s.roof, h, g);
  if (s.sag) roof.rotation.z = 0.025;

  // door + glass
  const door = box(1.3, 2.35, 0.08, s.door, 0.5, 1.2, D / 2 + 0.02, g);
  door.geometry.translate(-0.65, 0, 0);
  door.position.x = 0.65 + 0;
  door.name = 'door';
  const glass = std('#9fc4d8', { rough: 0.05, metal: 0.1, transparent: true, opacity: 0.25 });
  for (const [x, z, w, ph, py] of [[-2.5, D / 2, 1.2, 1.2, 1.7], [2.5, D / 2, 1.2, 1.2, 1.7], [0, -D / 2, backWin.w, backWin.y1 - backWin.y0, (backWin.y0 + backWin.y1) / 2]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, ph), glass);
    pane.position.set(x, py, z - Math.sign(z) * T / 2);
    g.add(pane);
  }

  // porch: steps, optional columns, cabin number
  box(W - 1, 0.25, 1.4, s.trim, 0, 0.12, D / 2 + 0.7, g);
  if (s.columns) {
    box(W + 0.4, 0.3, 2.4, s.trim, 0, h + 0.15, D / 2 + 1.1, g);
    const xs = s.columns === 4 ? [-3.4, -1.2, 1.2, 3.4] : [-3.3, 3.3];
    for (const x of xs) column(h, 0.2, s.trim, x, D / 2 + 2.0, g);
  }
  const plate = textPlane(ROMAN[CABIN_IDS.indexOf(id)], { w: 1.0, h: 0.45 });
  plate.position.set(0, 2.85, D / 2 + 0.03);
  g.add(plate);

  addExteriorDetails(id, g, s, h);

  if (interior) {
    const inside = new THREE.Group();
    inside.name = 'interior';
    // inner ceiling so the room isn't open to the roof cavity
    const ceil = box(W - T * 2, 0.08, D - T * 2, std('#6e5440'), 0, h - 0.04, 0, inside);
    ceil.castShadow = false;
    bunk(-W / 2 + 0.8, -1.2, inside);
    bunk(-W / 2 + 0.8, 1.6, inside);
    bunk(W / 2 - 0.8, 1.6, inside);
    const myBed = bunk(W / 2 - 0.8, -1.8, inside);
    myBed.name = 'my-bed';
    addInteriorProps(id, inside, s, h);
    const lamp = new THREE.PointLight('#ffcf8a', 8, 10, 1.2);
    lamp.position.set(0, h - 0.5, 0.5);
    inside.add(lamp);
    g.add(inside);
  }

  g.userData.anchors = {
    door: new THREE.Vector3(0, 0, D / 2 + 2.2),
    window: new THREE.Vector3(0, 1.6, -D / 2 + T + 0.85), // camera spot right at the back window
    windowSide: new THREE.Vector3(1.35, 0.2, -D / 2 + 1.1), // where 'me' stands beside it
    bed: new THREE.Vector3(W / 2 - 0.8, 0.9, -1.8),
    sound: new THREE.Vector3(0, 1.5, 0),
  };
  g.userData.id = id;
  g.userData.style = s;
  return g;
}

/** Place all 12 cabins in the Ω around the green. Odd (gods) west, even (goddesses) east. */
export function layoutCabins(scene, heightAt, { interiorFor } = {}) {
  const { radius } = LAYOUT.cabinRing;
  const step = THREE.MathUtils.degToRad(27.3);
  const map = new Map();
  CABIN_IDS.forEach((id, i) => {
    const n = i + 1;
    const k = Math.floor((n - 1) / 2); // 0..5
    const side = n % 2 === 1 ? -1 : 1;
    const a = side * (step / 2 + k * step);
    const r = radius + (id === 'zeus' || id === 'hera' ? 2 : 0);
    const x = Math.sin(a) * r;
    const z = -Math.cos(a) * r;
    // cabin interior lookup uses the god id; Artemis' hunters use cabin 8
    const cabin = buildCabin(id, { interior: id === interiorFor });
    cabin.position.set(x, heightAt(x, z), z);
    cabin.rotation.y = Math.atan2(-x, -z);
    cabin.scale.setScalar(STYLES[id].scale ?? 1);
    scene.add(cabin);
    cabin.updateMatrixWorld(true);
    cabin.userData.worldAnchors = Object.fromEntries(
      Object.entries(cabin.userData.anchors).map(([k2, v]) => [k2, v.clone().applyMatrix4(cabin.matrixWorld)]),
    );
    map.set(id, cabin);
  });
  return map;
}

/** Artemis' cabin glows silver under the moon. */
export function setCabinNightGlow(map, nightAmount) {
  const c = map.get('artemis');
  if (c) c.userData.style.wall.emissiveIntensity = nightAmount * 0.35;
}
