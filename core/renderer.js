import { loadType } from './registry.js';

let _currentApp = null;
let _currentSceneId = null;

export function initRenderer() {
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
  if (_currentApp) {
    await _currentApp.close();
    _currentApp = null;
  }
  _restore();
  _currentSceneId = null;

  const type = scene?.flags?.sceneforge?.type;
  if (!type) return;

  const SceneClass = await loadType(type);
  if (!SceneClass) {
    console.warn(`SceneForge | Unknown scene type: "${type}"`);
    return;
  }

  const chrome = _measureChrome();
  _suppress();

  _currentApp = new SceneClass(scene);
  await _currentApp.render({ force: true });
  _applyBounds(_currentApp, chrome);
  _currentSceneId = scene.id;
}

function _measureChrome() {
  const controlsStrip = document.querySelector('#scene-controls > *:first-child');
  const w = controlsStrip?.getBoundingClientRect().width ?? 0;
  return { top: w * 1.5, left: w * 4, right: w * 8, bottom: w * 1.5 };
}

function _applyBounds(app, chrome) {
  const el = app.element;
  if (!el) return;
  Object.assign(el.style, {
    position: 'fixed',
    top: `${chrome.top}px`,
    left: `${chrome.left}px`,
    right: `${chrome.right}px`,
    bottom: `${chrome.bottom}px`,
    margin: '0',
    maxHeight: 'none',
    zIndex: '80',
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
