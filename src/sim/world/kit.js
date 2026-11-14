import * as THREE from 'three';

// Small building kit shared by cabins and facilities.
const cache = new Map();
export function std(color, { rough = 0.85, metal = 0, emissive, emissiveIntensity = 0, side, transparent, opacity } = {}) {
  const key = [color, rough, metal, emissive, emissiveIntensity, side, transparent, opacity].join('|');
  if (!cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (emissive) { m.emissive.set(emissive); m.emissiveIntensity = emissiveIntensity; }
    if (side) m.side = side;
    if (transparent) { m.transparent = true; m.opacity = opacity ?? 0.5; m.depthWrite = false; }
    cache.set(key, m);
  }
  return cache.get(key);
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, parent, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

export function sphere(r, mat, x = 0, y = 0, z = 0, parent, seg = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent?.add(m);
  return m;
}

/** Greek column with base and capital. */
export function column(h, r, mat, x, z, parent) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  cyl(r * 1.35, r * 1.45, 0.18, mat, 0, 0.09, 0, g);
  cyl(r * 0.9, r, h - 0.4, mat, 0, (h - 0.4) / 2 + 0.18, 0, g, 16);
  box(r * 2.8, 0.22, r * 2.8, mat, 0, h - 0.11, 0, g);
  parent?.add(g);
  return g;
}

/**
 * A wall along local x (centered), thickness along z, with rectangular openings.
 * openings: [{ x: center, w: width, y0: bottom, y1: top }]
 */
export function wall(length, height, thick, mat, openings = [], parent) {
  const g = new THREE.Group();
  const ops = [...openings].sort((a, b) => a.x - b.x);
  let cursor = -length / 2;
  for (const o of ops) {
    const left = o.x - o.w / 2;
    if (left > cursor) box(left - cursor, height, thick, mat, (cursor + left) / 2, height / 2, 0, g);
    if (o.y0 > 0) box(o.w, o.y0, thick, mat, o.x, o.y0 / 2, 0, g);
    if (o.y1 < height) box(o.w, height - o.y1, thick, mat, o.x, (o.y1 + height) / 2, 0, g);
    cursor = o.x + o.w / 2;
  }
  if (cursor < length / 2) box(length / 2 - cursor, height, thick, mat, (cursor + length / 2) / 2, height / 2, 0, g);
  parent?.add(g);
  return g;
}

/** Gabled roof spanning width (x) and depth (z), ridge along z. */
export function gableRoof(width, depth, rise, mat, y, parent, overhang = 0.5) {
  const shape = new THREE.Shape();
  const w = width / 2 + overhang;
  shape.moveTo(-w, 0);
  shape.lineTo(0, rise);
  shape.lineTo(w, 0);
  shape.lineTo(-w, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depth + overhang * 2, bevelEnabled: false });
  geo.translate(0, 0, -(depth / 2 + overhang));
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

/** Text on a canvas texture plane (signs, cabin numbers). */
export function textPlane(text, { w = 1, h = 0.4, color = '#2a2015', bg = '#e8dcc0', font = '"ChosunGu", sans-serif', px = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const ctx = c.getContext('2d');
  const geo = new THREE.PlaneGeometry(w, h);
  if (!ctx) return new THREE.Mesh(geo, std(bg)); // jsdom: no 2D canvas
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color;
  // the face has one weight; asking for 700 would smear it into a fake bold
  ctx.font = `400 ${px}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}
