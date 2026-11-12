// Camp map in metres (y up). Origin = middle of the cabin green.
// North is -z. The canoe lake lies north-east, Half-Blood Hill with Thalia's pine to the south.
export const LAYOUT = {
  green: { x: 0, z: 0, radius: 16 },
  cabinRing: { x: 0, z: 0, radius: 26, openTowards: Math.PI / 2 }, // gap faces +z (south, toward the hill)
  lake: { x: 70, z: -80, rx: 48, rz: 34, level: -0.35 },
  dock: { x: 44, z: -58 },
  pavilion: { x: 38, z: -36 },
  bigHouse: { x: 40, z: 22 },
  arena: { x: -52, z: 8 },
  archery: { x: -58, z: -40 },
  stables: { x: 6, z: -54 },
  amphitheater: { x: -30, z: 44 },
  strawberries: { x: 62, z: 44 },
  hill: { x: 0, z: 115, radius: 34, height: 14 },
  thaliaPine: { x: 0, z: 112 },
  campRadius: 85, // trees stay outside this (except a few decorative ones)
};

// Distance-from-ellipse helper: <1 inside.
export function inLake(x, z, pad = 0) {
  const { x: cx, z: cz, rx, rz } = LAYOUT.lake;
  const dx = (x - cx) / (rx + pad);
  const dz = (z - cz) / (rz + pad);
  return dx * dx + dz * dz;
}
