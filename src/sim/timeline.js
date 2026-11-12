// The simulated day: 600 real seconds split into six scenes.
export const TOTAL = 600;

const DEFS = [
  // id, start, end, tod range (0 = 5:30 dawn, 1 = 22:00 night)
  ['dawn', 0, 90, 0, 0.08],
  ['overview', 90, 150, 0.08, 0.15],
  ['training', 150, 300, 0.15, 0.45],
  ['pegasus', 300, 390, 0.45, 0.6],
  ['dinner', 390, 480, 0.6, 0.78],
  ['campfire', 480, 600, 0.78, 1],
];

export const SCENES = DEFS.map(([id, start, end, tod0, tod1]) => ({
  id, start, end, tod0, tod1, captionKey: `scene.${id}`,
}));

const clamp = (t) => Math.min(Math.max(t, 0), TOTAL);

export function sceneAt(t) {
  const c = clamp(t);
  return SCENES.find((s) => c < s.end) ?? SCENES.at(-1);
}

export function sceneIndexAt(t) {
  return SCENES.indexOf(sceneAt(t));
}

export function sceneProgress(t) {
  const c = clamp(t);
  const s = sceneAt(c);
  return Math.min((c - s.start) / (s.end - s.start), 1);
}

export function timeOfDayAt(t) {
  const s = sceneAt(t);
  return s.tod0 + (s.tod1 - s.tod0) * sceneProgress(t);
}
