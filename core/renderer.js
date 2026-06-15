import { loadType } from './registry.js';
import { injectHandles } from './handles.js';

let _currentApp = null;
let _currentSceneId = null;
let _teardownHandles = null;
let _actorUpdateQueued = false;

export function initRenderer() {
  Hooks.on('canvasReady', _onCanvasReady);
  Hooks.on('updateScene', _onUpdateScene);
  Hooks.on('sceneforge:dataChanged', _onDataChanged);
  Hooks.on('updateActor', () => {
    if (!_currentApp?.rendered || _actorUpdateQueued) return;
    _actorUpdateQueued = true;
    requestAnimationFrame(async () => {
      _actorUpdateQueued = false;
      if (!_currentApp?.rendered) return;
      await _currentApp.render();
      _applyBounds(_currentApp);
    });
  });

  // In v14, canvasReady can fire before ready. If the canvas is already
  // initialised by the time we register, mount immediately.
  if (canvas?.ready) _onCanvasReady().catch(console.error);
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
    await _currentApp?.render({ force: true });
    if (_currentApp) _applyBounds(_currentApp);
  }
}

async function _onDataChanged(sceneId) {
  if (sceneId !== game.scenes.viewed?.id) return;
  await _currentApp?.render({ force: true });
  if (_currentApp) _applyBounds(_currentApp);
}

async function _mount(scene) {
  if (_teardownHandles) { _teardownHandles(); _teardownHandles = null; }
  if (_currentApp) { await _currentApp.close(); _currentApp = null; }
  _currentSceneId = null;

  const type = scene?.flags?.sceneforge?.type;

  if (!type) {
    _restore();
    return;
  }

  _suppress();

  const SceneClass = await loadType(type);
  if (!SceneClass) {
    console.warn(`SceneForge | Unknown scene type: "${type}"`);
    _restore();
    return;
  }

  _currentApp = new SceneClass(scene);
  await _currentApp.render({ force: true });
  _applyBounds(_currentApp);

  if (game.user.isGM) {
    _teardownHandles = injectHandles(_currentApp.element, scene);
  }

  _currentSceneId = scene.id;
}

function _getBounds() {
  const b = game.scenes.viewed?.flags?.sceneforge?.sceneBounds
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
