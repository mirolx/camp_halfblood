import { createApp } from './app.js';
import { createStage } from './three/renderer.js';
import { runClaiming } from './three/claimingScene.js';
import { runDebugView } from './sim/debugView.js';
import { createDirector } from './sim/director.js';

const stage = createStage(document.getElementById('stage'));
const app = createApp(document.getElementById('app'));
const params = new URLSearchParams(location.search);
const debugT = Number(params.get('t') ?? 0);

app.register('claiming', (el, go, state) =>
  runClaiming(stage, el, {
    godId: state.godId,
    gender: state.gender,
    onContinue: () => go('sim'),
    startAt: params.get('screen') === 'claiming' ? debugT : 0,
  }),
);

app.register('sim', (el, go, state) => {
  const director = createDirector(stage, {
    godId: state.godId,
    gender: state.gender,
    startAt: params.get('screen') === 'sim' ? debugT : 0,
  });
  director.onEnd(() => go('end'));
  window.__director = director;
  return { destroy: () => director.destroy() };
});

app.register('end', (el) => {
  const p = document.createElement('p');
  p.className = 'screen';
  p.textContent = 'end';
  el.appendChild(p);
  return { destroy: () => p.remove() };
});

if (params.get('screen') === 'debug') {
  app.register('debug', () => runDebugView(stage, { tod: Number(params.get('tod') ?? 0.3), interiorFor: params.get('god') ?? 'hermes' }));
  app.go('debug');
} else if (params.get('god')) {
  // debug shortcut: ?god=athena&gender=female&screen=claiming|sim&t=seconds
  Object.assign(app.state, { godId: params.get('god'), gender: params.get('gender') ?? 'female' });
  app.go(params.get('screen') ?? 'claiming');
} else {
  app.go('start');
}
window.__app = app;
window.__stage = stage;
