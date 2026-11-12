// Olympian cabins that can be a quiz result. Hera (cabin 2) is honorary in canon and never a result.
export const GODS = [
  { id: 'zeus', cabin: 1, color: '#e9e4d4', symbolColor: '#9fd3ff' },
  { id: 'poseidon', cabin: 3, color: '#4f8a8b', symbolColor: '#5fe0d0' },
  { id: 'demeter', cabin: 4, color: '#8bb35a', symbolColor: '#e8d36a' },
  { id: 'ares', cabin: 5, color: '#a3332b', symbolColor: '#ff4a2e' },
  { id: 'athena', cabin: 6, color: '#9aa3ad', symbolColor: '#d8e2ec' },
  { id: 'apollo', cabin: 7, color: '#e2b543', symbolColor: '#ffd75e' },
  { id: 'artemis', cabin: 8, color: '#c9ced6', symbolColor: '#dfe8ff' },
  { id: 'hephaestus', cabin: 9, color: '#6b5b4b', symbolColor: '#ff9a3c' },
  { id: 'aphrodite', cabin: 10, color: '#e7a3b5', symbolColor: '#ff9ec0' },
  { id: 'hermes', cabin: 11, color: '#8a6a4a', symbolColor: '#ffe28a' },
  { id: 'dionysus', cabin: 12, color: '#6d3f7a', symbolColor: '#c58bff' },
].map((g) => ({
  ...g,
  nameKey: `god.${g.id}.name`,
  titleKey: `god.${g.id}.title`,
  descKey: `god.${g.id}.desc`,
}));

export const GOD_IDS = GODS.map((g) => g.id);

export function getGod(id) {
  const g = GODS.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown god: ${id}`);
  return g;
}
