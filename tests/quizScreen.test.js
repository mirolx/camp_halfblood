import { beforeEach, describe, expect, test, vi } from 'vitest';

let i18n, mountStartScreen, mountQuizScreen, strings;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  i18n = await import('../src/i18n/i18n.js');
  ({ strings } = await import('../src/i18n/strings.js'));
  ({ mountStartScreen } = await import('../src/ui/startScreen.js'));
  ({ mountQuizScreen } = await import('../src/ui/quizScreen.js'));
});

const app = () => document.getElementById('app');
const options = () => [...app().querySelectorAll('.quiz-option')];
const questionText = () => app().querySelector('.quiz-question').textContent;

describe('start screen', () => {
  test('start button disabled until gender picked, then reports gender', () => {
    const onStart = vi.fn();
    mountStartScreen(app(), { onStart });
    const start = app().querySelector('.start-button');
    expect(start.disabled).toBe(true);
    app().querySelector('[data-gender="female"]').click();
    expect(start.disabled).toBe(false);
    start.click();
    expect(onStart).toHaveBeenCalledWith('female');
  });
});

describe('quiz screen', () => {
  test('answering 12 questions calls onDone with 12 indices', () => {
    const onDone = vi.fn();
    mountQuizScreen(app(), { onDone });
    for (let i = 0; i < 12; i++) options()[i % 4].click();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
  });

  test('switching language mid-quiz keeps progress and answers', () => {
    const onDone = vi.fn();
    mountQuizScreen(app(), { onDone });
    options()[2].click();
    options()[1].click();
    options()[3].click();
    expect(questionText()).toBe(strings.ko['q4.text']);
    i18n.setLang('en');
    expect(questionText()).toBe(strings.en['q4.text']);
    for (let i = 3; i < 12; i++) options()[0].click();
    expect(onDone.mock.calls[0][0].slice(0, 3)).toEqual([2, 1, 3]);
  });

  test('back button returns to previous question with its answer selected', () => {
    mountQuizScreen(app(), { onDone: vi.fn() });
    options()[2].click();
    app().querySelector('.quiz-back').click();
    expect(questionText()).toBe(strings.ko['q1.text']);
    expect(options()[2].classList.contains('selected')).toBe(true);
  });

  test('back button hidden on the first question', () => {
    mountQuizScreen(app(), { onDone: vi.fn() });
    expect(app().querySelector('.quiz-back').hidden).toBe(true);
  });
});
