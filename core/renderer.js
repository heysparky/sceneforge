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
  const nav = document.getElementById('navigation');
  const controls = document.getElementById('scene-controls');
  const sidebar = document.getElementById('sidebar');
  const hotbar = document.getElementById('hotbar');
  return {
    top: nav?.getBoundingClientRect().bottom ?? 0,
    left: controls?.getBoundingClientRect().right ?? 0,
    right: sidebar ? window.innerWidth - sidebar.getBoundingClientRect().left : 0,
    bottom: hotbar ? window.innerHeight - hotbar.getBoundingClientRect().top : 0,
  };
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
