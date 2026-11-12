import { createApp } from './app.js';
import { createStage } from './three/renderer.js';
import { runClaiming } from './three/claimingScene.js';
import { runDebugView } from './sim/debugView.js';

const stage = createStage(document.getElementById('stage'));
const app = createApp(document.getElementById('app'));

app.register('claiming', (el, go, state) =>
  runClaiming(stage, el, {
    godId: state.godId,
    gender: state.gender,
    onContinue: () => go('sim'),
    startAt: Number(new URLSearchParams(location.search).get('t') ?? 0),
  }),
);

const params = new URLSearchParams(location.search);
if (params.get('screen') === 'debug') {
  app.register('debug', () => runDebugView(stage, { tod: Number(params.get('tod') ?? 0.3) }));
}
if (params.get('screen') === 'debug') {
  app.go('debug');
} else if (params.get('god')) {
  // debug shortcut: ?god=athena&gender=female&screen=claiming
  Object.assign(app.state, { godId: params.get('god'), gender: params.get('gender') ?? 'female' });
  app.go(params.get('screen') ?? 'claiming');
} else {
  app.go('start');
}
window.__app = app;
window.__stage = stage;
