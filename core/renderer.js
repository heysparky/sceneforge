import { loadType } from './registry.js';
import { injectHandles } from './handles.js';

let _currentApp = null;
let _currentSceneId = null;
let _teardownHandles = null;
let _renderQueued = false;

export function initRenderer() {
  Hooks.on('canvasReady', _onCanvasReady);
  Hooks.on('updateScene', _onUpdateScene);
  Hooks.on('sceneforge:dataChanged', _onDataChanged);
  // Actor and user changes (sheet edits, players joining or leaving) re-render once per frame.
  Hooks.on('updateActor', _queueRender);
  Hooks.on('updateUser', _queueRender);
  Hooks.on('userConnected', _queueRender);
  window.addEventListener('resize', () => {
    if (_currentApp?.rendered) _applyBounds(_currentApp);
  });

  // In v14, canvasReady can fire before ready. If the canvas is already
  // initialised by the time we register, mount immediately.
  if (canvas?.ready) _onCanvasReady().catch(console.error);
}

function _queueRender() {
  if (!_currentApp?.rendered || _renderQueued) return;
  _renderQueued = true;
  requestAnimationFrame(async () => {
    _renderQueued = false;
    if (!_currentApp?.rendered) return;
    await _currentApp.render();
    _applyBounds(_currentApp);
  });
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
    if (_currentApp) _applyBoundsSafe(_currentApp);
  }
}

async function _onDataChanged(sceneId) {
  if (sceneId !== game.scenes.viewed?.id) return;
  await _currentApp?.render({ force: true });
  if (_currentApp) _applyBoundsSafe(_currentApp);
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
  _applyBoundsSafe(_currentApp);

  if (game.user.isGM) {
    _teardownHandles = injectHandles(_currentApp.element, scene);
  }

  _currentSceneId = scene.id;
}

// Until a GM drags the handles, a scene opens at a fixed size (six roster characters
// with no scrolling), centered, and shrunk only if the window is too small to hold it.
const DEFAULT_SIZE   = { width: 1140, height: 890 };
const DEFAULT_MARGIN = 24;

function _getBounds() {
  const b = game.scenes.viewed?.flags?.sceneforge?.sceneBounds;
  if (!b) {
    const w = Math.min(DEFAULT_SIZE.width,  window.innerWidth  - 2 * DEFAULT_MARGIN);
    const h = Math.min(DEFAULT_SIZE.height, window.innerHeight - 2 * DEFAULT_MARGIN);
    const x = (window.innerWidth  - w) / 2;
    const y = (window.innerHeight - h) / 2;
    return { top: y, left: x, right: x, bottom: y };
  }
  return {
    top:    (b.top    / 100) * window.innerHeight,
    left:   (b.left   / 100) * window.innerWidth,
    right:  (b.right  / 100) * window.innerWidth,
    bottom: (b.bottom / 100) * window.innerHeight,
  };
}

const MIN_APP_HEIGHT = 460;

function _applyBounds(app) {
  const el = app.element;
  if (!el) return;
  const b = _getBounds();
  const rawHeight = window.innerHeight - b.top - b.bottom;
  const bottom = rawHeight < MIN_APP_HEIGHT
    ? Math.max(0, window.innerHeight - b.top - MIN_APP_HEIGHT)
    : b.bottom;
  Object.assign(el.style, {
    position:  'fixed',
    top:       `${b.top}px`,
    left:      `${b.left}px`,
    right:     `${b.right}px`,
    bottom:    `${bottom}px`,
    margin:    '0',
    maxHeight: 'none',
    zIndex:    '80',
  });
}

function _applyBoundsSafe(app) {
  _applyBounds(app);
  requestAnimationFrame(() => { if (app === _currentApp && app.rendered) _applyBounds(app); });
}

function _suppress() {
  document.getElementById('board')?.style.setProperty('display', 'none');
  document.getElementById('hud')?.style.setProperty('display', 'none');
}

function _restore() {
  document.getElementById('board')?.style.removeProperty('display');
  document.getElementById('hud')?.style.removeProperty('display');
}
