import { createApp } from './app.js';
import { createStage } from './three/renderer.js';
import { runClaiming } from './three/claimingScene.js';
import { runDebugView } from './sim/debugView.js';
import { createDirector } from './sim/director.js';
import { mountHud } from './ui/hud.js';
import { mountEndScreen } from './ui/endScreen.js';
import { sceneAt } from './sim/timeline.js';

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
  const hud = mountHud(el, { director, cameras: director.cameras, audio: null });
  hud.showCaption(sceneAt(director.elapsed()));
  // the ending sits on top of the starry final shot instead of replacing it
  let end = null;
  let endTimer = null;
  director.onEnd(() => {
    endTimer = setTimeout(() => {
      hud.destroy();
      document.body.dataset.screen = 'end';
      end = mountEndScreen(el, { onReplay: () => go('sim'), onRetake: () => go('start') });
    }, 2500);
  });
  window.__director = director;
  return {
    destroy: () => {
      clearTimeout(endTimer);
      end?.destroy();
      hud.destroy();
      director.destroy();
    },
  };
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
