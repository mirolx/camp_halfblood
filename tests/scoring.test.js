import { describe, expect, test } from 'vitest';
import { GODS, GOD_IDS } from '../src/quiz/gods.js';
import { QUESTIONS } from '../src/quiz/questions.js';
import { scoreQuiz, scoreBreakdown } from '../src/quiz/scoring.js';
import { strings } from '../src/i18n/strings.js';

// Answers that always pick the option giving `god` the most weight (ties: first).
function answersFavoring(god) {
  return QUESTIONS.map((q) => {
    let best = 0;
    q.options.forEach((o, i) => {
      if ((o.weights[god] ?? 0) > (q.options[best].weights[god] ?? 0)) best = i;
    });
    return best;
  });
}

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('data', () => {
  test('11 gods, no hera', () => {
    expect(GODS).toHaveLength(11);
    expect(GOD_IDS).not.toContain('hera');
  });

  test('QUESTIONS has 12 questions with 4 options each', () => {
    expect(QUESTIONS).toHaveLength(12);
    for (const q of QUESTIONS) expect(q.options).toHaveLength(4);
  });

  test('weights only reference known gods, 1-3 gods per option, values 1..3', () => {
    for (const q of QUESTIONS) for (const o of q.options) {
      const ids = Object.keys(o.weights);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(3);
      for (const id of ids) {
        expect(GOD_IDS).toContain(id);
        expect(o.weights[id]).toBeGreaterThanOrEqual(1);
        expect(o.weights[id]).toBeLessThanOrEqual(3);
      }
    }
  });

  test('every god appears in weights at least 4 times', () => {
    const count = Object.fromEntries(GOD_IDS.map((g) => [g, 0]));
    for (const q of QUESTIONS) for (const o of q.options) for (const g of Object.keys(o.weights)) count[g]++;
    for (const g of GOD_IDS) expect(count[g], g).toBeGreaterThanOrEqual(4);
  });

  test('all text keys exist in strings', () => {
    const keys = [
      ...GODS.flatMap((g) => [g.nameKey, g.descKey, g.titleKey]),
      ...QUESTIONS.flatMap((q) => [q.textKey, ...q.options.map((o) => o.textKey)]),
    ];
    for (const k of keys) expect(strings.ko[k], k).toBeTruthy();
  });
});

describe('scoreQuiz', () => {
  test('each god is reachable', () => {
    for (const g of GOD_IDS) expect(scoreQuiz(answersFavoring(g), 'female'), g).toBe(g);
  });

  test('male never gets artemis', () => {
    const a = answersFavoring('artemis');
    expect(scoreQuiz(a, 'female')).toBe('artemis');
    expect(scoreQuiz(a, 'male')).not.toBe('artemis');
    expect(scoreBreakdown(a, 'male').artemis).toBeUndefined();
  });

  test('tie-break favors later questions', () => {
    const qs = [
      { options: [{ weights: { zeus: 2 } }, { weights: { ares: 2 } }] },
      { options: [{ weights: { zeus: 2 } }, { weights: { ares: 2 } }] },
    ];
    expect(scoreQuiz([0, 1], 'female', qs)).toBe('ares');
    expect(scoreQuiz([1, 0], 'female', qs)).toBe('zeus');
  });

  test('random answers are reasonably spread', () => {
    const rand = mulberry32(42);
    const tally = Object.fromEntries(GOD_IDS.map((g) => [g, 0]));
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const a = QUESTIONS.map(() => Math.floor(rand() * 4));
      tally[scoreQuiz(a, 'female')]++;
    }
    for (const g of GOD_IDS) {
      expect(tally[g] / N, `${g} ${tally[g]}`).toBeLessThan(0.25);
      expect(tally[g] / N, `${g} ${tally[g]}`).toBeGreaterThan(0.02);
    }
  });

  test('rejects incomplete answers', () => {
    expect(() => scoreQuiz([0, 1], 'female')).toThrow();
  });
});
