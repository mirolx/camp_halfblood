import { mountLangToggle } from './ui/langToggle.js';
import { mountStartScreen } from './ui/startScreen.js';
import { mountQuizScreen } from './ui/quizScreen.js';
import { scoreQuiz } from './quiz/scoring.js';

// Screen state machine: start -> quiz -> claiming -> sim -> end.
// Later stages register themselves via app.register(name, mountFn).
export function createApp(root) {
  const state = { gender: null, answers: null, godId: null };
  const screens = {
    start: (el, go) => mountStartScreen(el, {
      onStart: (gender) => { state.gender = gender; go('quiz'); },
    }),
    quiz: (el, go) => mountQuizScreen(el, {
      onDone: (answers) => {
        state.answers = answers;
        state.godId = scoreQuiz(answers, state.gender);
        go('claiming');
      },
    }),
  };
  let current = null;
  const listeners = new Set();

  function go(name) {
    current?.destroy?.();
    current = null;
    const mount = screens[name];
    if (!mount) throw new Error(`No screen registered: ${name}`);
    document.body.dataset.screen = name;
    current = mount(root, go, state) ?? null;
    for (const fn of listeners) fn(name, state);
  }

  mountLangToggle(document.body);

  return {
    state,
    go,
    register: (name, mount) => { screens[name] = mount; },
    onScreen: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
