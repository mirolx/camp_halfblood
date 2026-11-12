// Every sound the simulation can play. Files live under assets/audio/.
// Missing files are fine: the engine skips them, so the app runs before all audio is sourced.
//   kind: ambient = looping layer that fades with scenes; oneshot = single hit; music = looped track
//   at: oneshot fires once when scene progress passes this fraction
//   every: [min, max] seconds between random repeats while in the scene
//   position: anchor name for 3D sound (see director anchors), omitted = non-positional
export const SOUNDS = [
  // ambience
  { id: 'dawn-birds', file: 'sfx/dawn_birds.mp3', kind: 'ambient', scenes: ['dawn', 'overview'], volume: 0.55 },
  { id: 'day-birds', file: 'sfx/day_birds.mp3', kind: 'ambient', scenes: ['training', 'pegasus'], volume: 0.3 },
  { id: 'wind-forest', file: 'sfx/wind_forest.mp3', kind: 'ambient', scenes: ['dawn', 'overview', 'training', 'pegasus', 'dinner', 'campfire'], volume: 0.25 },
  { id: 'lake', file: 'sfx/lake_lapping.mp3', kind: 'ambient', scenes: ['dawn', 'pegasus', 'dinner'], volume: 0.5, position: 'lake' },
  { id: 'camp-crowd', file: 'sfx/camp_crowd.mp3', kind: 'ambient', scenes: ['overview', 'training', 'pegasus'], volume: 0.35 },
  { id: 'dining', file: 'sfx/dining_hall.mp3', kind: 'ambient', scenes: ['dinner'], volume: 0.6, position: 'pavilion' },
  { id: 'campfire', file: 'sfx/campfire.mp3', kind: 'ambient', scenes: ['campfire'], volume: 0.75, position: 'campfire' },
  { id: 'crickets', file: 'sfx/crickets.mp3', kind: 'ambient', scenes: ['dinner', 'campfire'], volume: 0.35 },

  // events
  { id: 'conch', file: 'sfx/conch_horn.mp3', kind: 'oneshot', scenes: ['dawn'], at: 0.04, volume: 1 },
  { id: 'conch-dinner', file: 'sfx/conch_horn.mp3', kind: 'oneshot', scenes: ['dinner'], at: 0.01, volume: 0.7 },
  { id: 'door', file: 'sfx/door_creak.mp3', kind: 'oneshot', scenes: ['dawn'], at: 0.46, volume: 0.7 },
  { id: 'arrow', file: 'sfx/arrow_hit.mp3', kind: 'oneshot', scenes: ['training'], every: [0.9, 2.6], volume: 0.7, position: 'archery' },
  { id: 'swords', file: 'sfx/sword_clash.mp3', kind: 'oneshot', scenes: ['training'], every: [0.8, 2.2], volume: 0.6, position: 'arena' },
  { id: 'wings', file: 'sfx/wings_flap.mp3', kind: 'oneshot', scenes: ['pegasus'], every: [2.5, 5], volume: 0.8, position: 'pegasus' },
  { id: 'neigh', file: 'sfx/horse_neigh.mp3', kind: 'oneshot', scenes: ['pegasus'], every: [9, 18], volume: 0.6, position: 'pegasus' },

  // music (made with Suno by the user — see docs/suno-prompts.md)
  { id: 'campfire-song', file: 'music/campfire.mp3', kind: 'music', scenes: ['campfire'], volume: 0.8 },
  { id: 'quiz-bg', file: 'music/quiz_bg.mp3', kind: 'music', volume: 0.45 },
  { id: 'claiming', file: 'music/claiming.mp3', kind: 'music', volume: 0.9 },
];
