import * as quiz from './content/quiz.js';
import * as ui from './content/ui.js';

// All user-facing copy. Every key must exist in both languages (enforced by tests/i18n.test.js).
export const strings = {
  ko: {
    'app.title': '캠프 하프블러드',
    'quiz.progress': '{n} / {total}',
    'lang.ko': '한',
    'lang.en': 'EN',
    ...quiz.ko,
    ...ui.ko,
  },
  en: {
    'app.title': 'Camp Half-Blood',
    'quiz.progress': '{n} / {total}',
    'lang.ko': '한',
    'lang.en': 'EN',
    ...quiz.en,
    ...ui.en,
  },
};

export function addStrings(ko, en) {
  Object.assign(strings.ko, ko);
  Object.assign(strings.en, en);
}
