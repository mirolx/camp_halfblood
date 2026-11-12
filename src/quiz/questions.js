// 12 questions x 4 options. Each option gives 1-3 points to 1-3 gods.
// Copy lives in src/i18n/content/quiz.js under q<N>.text / q<N>.o<M>.
const W = [
  // q1: what you pack for a quest
  [{ ares: 2, zeus: 1 }, { athena: 3, hephaestus: 1 }, { artemis: 2, apollo: 1, demeter: 1 }, { dionysus: 2, hermes: 1, aphrodite: 1 }],
  // q2: first place you go in free time
  [{ poseidon: 3 }, { hephaestus: 3 }, { demeter: 2, artemis: 1 }, { apollo: 2, aphrodite: 1, dionysus: 1 }],
  // q3: your role on a team
  [{ zeus: 3, ares: 1 }, { athena: 2, hermes: 1 }, { dionysus: 2, aphrodite: 1, apollo: 1 }, { apollo: 2, demeter: 2 }],
  // q4: a friend is in danger
  [{ poseidon: 2, ares: 2 }, { hermes: 3 }, { hephaestus: 2, athena: 1 }, { aphrodite: 2, zeus: 1 }],
  // q5: what you can't stand
  [{ zeus: 2, athena: 1 }, { hermes: 2, dionysus: 2 }, { poseidon: 2, artemis: 2 }, { demeter: 2, hephaestus: 1, aphrodite: 1 }],
  // q6: how friends describe you
  [{ poseidon: 2, ares: 1 }, { aphrodite: 3 }, { hephaestus: 2, demeter: 1 }, { apollo: 3 }],
  // q7: capture the flag strategy
  [{ ares: 3 }, { athena: 3 }, { hermes: 2, artemis: 1 }, { demeter: 1, apollo: 1, poseidon: 1 }],
  // q8: a gift from the gods
  [{ zeus: 3 }, { artemis: 3 }, { aphrodite: 2, dionysus: 1 }, { hephaestus: 3 }],
  // q9: ideal evening
  [{ dionysus: 3 }, { artemis: 2, athena: 1 }, { apollo: 2, hermes: 1 }, { poseidon: 2, aphrodite: 1 }],
  // q10: when you're angry
  [{ ares: 2, zeus: 1 }, { poseidon: 2 }, { demeter: 2, hephaestus: 1 }, { hermes: 2, dionysus: 1 }],
  // q11: what matters most
  [{ zeus: 2, ares: 1 }, { athena: 2, apollo: 1 }, { aphrodite: 2, demeter: 1 }, { artemis: 2, hermes: 1, poseidon: 1 }],
  // q12: one camp activity only
  [{ ares: 2, zeus: 1 }, { poseidon: 2, zeus: 1 }, { apollo: 2, artemis: 2 }, { demeter: 3, dionysus: 1 }],
];

export const QUESTIONS = W.map((opts, qi) => ({
  id: `q${qi + 1}`,
  textKey: `q${qi + 1}.text`,
  options: opts.map((weights, oi) => ({ textKey: `q${qi + 1}.o${oi + 1}`, weights })),
}));
