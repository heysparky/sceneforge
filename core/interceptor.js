import { loadSceneType } from './registry.js';
import { mountGMControls, unmountGMControls } from './gm-controls.js';

let activeApp = null;
let sfContainer = null;
let boundsObserver = null;

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

  startBoundsTracking();

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
  stopBoundsTracking();
  sfContainer?.remove();
  sfContainer = null;
  restoreCanvas();
}

// ── Bounds tracking ───────────────────────────────────────────

function computeCanvasBounds() {
  const get = id => document.getElementById(id);
  const controls = get('controls') ?? get('ui-left');
  const nav      = get('navigation') ?? get('ui-top');
  const sidebar  = get('sidebar') ?? get('ui-right');
  const hotbar   = get('hotbar') ?? get('ui-bottom');

  const left   = controls ? controls.getBoundingClientRect().right  : 0;
  const top    = nav      ? nav.getBoundingClientRect().bottom      : 0;
  const right  = (sidebar && !sidebar.classList.contains('collapsed'))
    ? sidebar.getBoundingClientRect().left
    : window.innerWidth;
  const bottom = hotbar ? hotbar.getBoundingClientRect().top : window.innerHeight;

  return {
    left,
    top,
    width:  Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function applyBounds() {
  if (!sfContainer) return;
  const { left, top, width, height } = computeCanvasBounds();
  Object.assign(sfContainer.style, {
    left:   `${left}px`,
    top:    `${top}px`,
    width:  `${width}px`,
    height: `${height}px`,
  });
}

function startBoundsTracking() {
  applyBounds();

  boundsObserver = new ResizeObserver(applyBounds);
  for (const id of ['controls', 'navigation', 'sidebar', 'hotbar', 'ui-left', 'ui-top', 'ui-right', 'ui-bottom']) {
    const el = document.getElementById(id);
    if (el) boundsObserver.observe(el);
  }

  Hooks.on('collapseSidebar', applyBounds);
  window.addEventListener('resize', applyBounds);
}

function stopBoundsTracking() {
  boundsObserver?.disconnect();
  boundsObserver = null;
  Hooks.off('collapseSidebar', applyBounds);
  window.removeEventListener('resize', applyBounds);
}

// ── Canvas suppression ────────────────────────────────────────

function suppressCanvas() {
  document.getElementById('board')?.style.setProperty('display', 'none');
  document.getElementById('hud')?.style.setProperty('display', 'none');
}

function restoreCanvas() {
  document.getElementById('board')?.style.removeProperty('display');
  document.getElementById('hud')?.style.removeProperty('display');
}
