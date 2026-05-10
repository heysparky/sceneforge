import { loadSceneType } from './registry.js';
import { mountGMControls, unmountGMControls } from './gm-controls.js';

let activeApp = null;
let sfContainer = null;

export async function onCanvasReady() {
  teardownActive();

  const scene = game.scenes.active;
  if (!scene) return;

  const type = scene.getFlag('sceneforge', 'type');
  if (!type) return;

  suppressCanvas();

  sfContainer = document.createElement('div');
  sfContainer.id = 'sceneforge-container';
  (document.getElementById('interface') ?? document.body).appendChild(sfContainer);

  const contentEl = document.createElement('div');
  contentEl.id = 'sceneforge-content';
  sfContainer.appendChild(contentEl);

  const mod = await loadSceneType(type);
  if (!mod?.default) {
    console.error(`SceneForge | Unknown or failed to load scene type: "${type}"`);
    return;
  }

  activeApp = new mod.default();
  await activeApp.render(scene, contentEl);

  mountGMControls(sfContainer, activeApp.gmControls());
}

function teardownActive() {
  activeApp?.teardown();
  activeApp = null;
  unmountGMControls();
  sfContainer?.remove();
  sfContainer = null;
  restoreCanvas();
}

function suppressCanvas() {
  document.getElementById('board')?.style.setProperty('display', 'none');
  document.getElementById('hud')?.style.setProperty('display', 'none');
}

function restoreCanvas() {
  document.getElementById('board')?.style.removeProperty('display');
  document.getElementById('hud')?.style.removeProperty('display');
}
