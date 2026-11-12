import { h, bindI18n } from './dom.js';
import { onLangChange, t } from '../i18n/i18n.js';
import { QUESTIONS } from '../quiz/questions.js';

export function mountQuizScreen(parent, { onDone }) {
  const answers = [];
  let index = 0;

  const bar = h('div', { cls: 'quiz-bar-fill' });
  const progress = h('span', { cls: 'quiz-progress' });
  const question = h('h2', { cls: 'quiz-question' });
  const list = h('div', { cls: 'quiz-options' });
  const back = h('button', { cls: 'quiz-back', text: 'quiz.back', attrs: { type: 'button' } });

  const root = h('section', { cls: 'screen quiz-screen' }, [
    h('div', { cls: 'quiz-bar' }, [bar]),
    progress,
    question,
    list,
    back,
  ]);

  function render() {
    const q = QUESTIONS[index];
    bar.style.width = `${(index / QUESTIONS.length) * 100}%`;
    progress.textContent = t('quiz.progress', { n: index + 1, total: QUESTIONS.length });
    question.textContent = t(q.textKey);
    list.replaceChildren(
      ...q.options.map((o, i) => {
        const b = h('button', { cls: 'quiz-option', attrs: { type: 'button' } });
        b.textContent = t(o.textKey);
        if (answers[index] === i) b.classList.add('selected');
        b.addEventListener('click', () => choose(i));
        return b;
      }),
    );
    back.hidden = index === 0;
    root.classList.remove('enter');
    void root.offsetWidth;
    root.classList.add('enter');
  }

  function choose(i) {
    answers[index] = i;
    if (index === QUESTIONS.length - 1) {
      bar.style.width = '100%';
      onDone(answers.slice());
      return;
    }
    index++;
    render();
  }

  back.addEventListener('click', () => {
    if (index > 0) { index--; render(); }
  });

  const offA = bindI18n(root);
  const offB = onLangChange(render);
  parent.appendChild(root);
  render();
  return { destroy: () => { offA(); offB(); root.remove(); } };
}
