import { loadType } from './registry.js';
import { injectHandles } from './handles.js';

let _currentApp = null;
let _currentSceneId = null;
let _teardownHandles = null;
let _splash = null;

export function initRenderer() {
  // On hard reload, show a solid splash overlay to cover the gray PIXI grid
  // while canvasReady fires and the SceneForge app loads. We do NOT suppress
  // #board here — doing so prevents PIXI from initialising and canvasReady
  // from firing. The splash is removed once _mount completes.
  if (game.scenes?.viewed?.flags?.sceneforge?.type) _showSplash();

  Hooks.on('canvasReady', _onCanvasReady);
  Hooks.on('updateScene', _onUpdateScene);
  Hooks.on('sceneforge:dataChanged', _onDataChanged);
}

async function _onCanvasReady() {
  await _mount(game.scenes.viewed);
}

async function _onUpdateScene(scene, diff) {
  if (scene.id !== game.scenes.viewed?.id) return;
  if (!diff?.flags?.sceneforge) return;

  const newType = scene?.flags?.sceneforge?.type ?? null;
  const currentType = _currentApp?.constructor.TYPE ?? null;

  if (newType !== currentType) {
    await _mount(scene);
  } else {
    _currentApp?.render({ force: true });
  }
}

function _onDataChanged(sceneId) {
  if (sceneId !== game.scenes.viewed?.id) return;
  _currentApp?.render({ force: true });
}

async function _mount(scene) {
  if (_teardownHandles) { _teardownHandles(); _teardownHandles = null; }
  if (_currentApp) { await _currentApp.close(); _currentApp = null; }
  _currentSceneId = null;

  const type = scene?.flags?.sceneforge?.type;

  if (!type) {
    _restore();
    _hideSplash();
    return;
  }

  _suppress();

  const SceneClass = await loadType(type);
  if (!SceneClass) {
    console.warn(`SceneForge | Unknown scene type: "${type}"`);
    _restore();
    _hideSplash();
    return;
  }

  _currentApp = new SceneClass(scene);
  await _currentApp.render({ force: true });
  _applyBounds(_currentApp);

  if (game.user.isGM) {
    _teardownHandles = injectHandles(_currentApp.element);
  }

  _currentSceneId = scene.id;
  _hideSplash();
}

function _showSplash() {
  if (_splash) return;
  _splash = document.createElement('div');
  Object.assign(_splash.style, {
    position: 'fixed',
    inset: '0',
    background: 'var(--color-bg, #1a1a2e)',
    zIndex: '10000',
    pointerEvents: 'none',
  });
  document.body.appendChild(_splash);
}

function _hideSplash() {
  _splash?.remove();
  _splash = null;
}

function _getBounds() {
  const b = game.settings.get('sceneforge', 'sceneBounds')
    ?? { top: 25, left: 25, right: 25, bottom: 25 };
  return {
    top:    (b.top    / 100) * window.innerHeight,
    left:   (b.left   / 100) * window.innerWidth,
    right:  (b.right  / 100) * window.innerWidth,
    bottom: (b.bottom / 100) * window.innerHeight,
  };
}

function _applyBounds(app) {
  const el = app.element;
  if (!el) return;
  const b = _getBounds();
  Object.assign(el.style, {
    position:  'fixed',
    top:       `${b.top}px`,
    left:      `${b.left}px`,
    right:     `${b.right}px`,
    bottom:    `${b.bottom}px`,
    margin:    '0',
    maxHeight: 'none',
    zIndex:    '80',
  });
}

function _suppress() {
  document.getElementById('board')?.style.setProperty('display', 'none');
  document.getElementById('hud')?.style.setProperty('display', 'none');
}

function _restore() {
  document.getElementById('board')?.style.removeProperty('display');
  document.getElementById('hud')?.style.removeProperty('display');
}
