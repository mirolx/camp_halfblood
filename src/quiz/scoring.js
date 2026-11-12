import { GOD_IDS } from './gods.js';
import { QUESTIONS } from './questions.js';

// Later questions weigh very slightly more so ties resolve toward recent answers.
const LATE_BONUS = 0.01;

export function scoreBreakdown(answers, gender, questions = QUESTIONS) {
  if (answers.length !== questions.length) {
    throw new Error(`Expected ${questions.length} answers, got ${answers.length}`);
  }
  const eligible = gender === 'male' ? GOD_IDS.filter((g) => g !== 'artemis') : GOD_IDS;
  const totals = {};
  answers.forEach((choice, qi) => {
    const opt = questions[qi].options[choice];
    if (!opt) throw new Error(`Invalid choice ${choice} for question ${qi}`);
    for (const [god, w] of Object.entries(opt.weights)) {
      if (!eligible.includes(god)) continue;
      totals[god] = (totals[god] ?? 0) + w * (1 + qi * LATE_BONUS);
    }
  });
  return totals;
}

export function scoreQuiz(answers, gender, questions = QUESTIONS) {
  const totals = scoreBreakdown(answers, gender, questions);
  let best = null;
  for (const god of GOD_IDS) {
    if (!(god in totals)) continue;
    if (best === null || totals[god] > totals[best] + 1e-9) best = god;
  }
  return best ?? (gender === 'male' ? 'hermes' : GOD_IDS[0]);
}
