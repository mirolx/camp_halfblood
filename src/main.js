import { createApp } from './app.js';

const app = createApp(document.getElementById('app'));
// Temporary until the claiming scene exists (Task 5).
app.register('claiming', (el, go, state) => {
  const p = document.createElement('p');
  p.className = 'screen';
  p.textContent = `claimed: ${state.godId}`;
  el.appendChild(p);
  return { destroy: () => p.remove() };
});
app.go('start');
window.__app = app;
