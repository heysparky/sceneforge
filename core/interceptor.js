import { loadSceneType } from './registry.js';
import { mountGMControls, unmountGMControls } from './gm-controls.js';

let activeApp = null;
let sfContainer = null;
let boundsObserver = null;

export async function onCanvasReady() {
  teardownActive();

  const scene = canvas.scene;
  if (!scene) return;

  const type = scene.getFlag('sceneforge', 'type');
  if (!type) return;

  suppressCanvas();

  sfContainer = document.createElement('div');
  sfContainer.id = 'sceneforge-container';
  document.body.appendChild(sfContainer);

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
  // #board is sized by Foundry to fill exactly the usable canvas area.
  // visibility:hidden keeps it in layout so getBoundingClientRect() stays valid.
  const board = document.getElementById('board');
  if (board) {
    const { left, top, width, height } = board.getBoundingClientRect();
    return { left, top, width: Math.max(0, width), height: Math.max(0, height) };
  }
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
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
  const board = document.getElementById('board');
  if (board) boundsObserver.observe(board);

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
  const board = document.getElementById('board');
  if (board) {
    // visibility:hidden not display:none — board keeps its layout dimensions
    // so getBoundingClientRect() stays valid for bounds tracking.
    board.style.setProperty('visibility', 'hidden');
    board.style.setProperty('pointer-events', 'none');
  }
  document.getElementById('hud')?.style.setProperty('display', 'none');
}

function restoreCanvas() {
  const board = document.getElementById('board');
  if (board) {
    board.style.removeProperty('visibility');
    board.style.removeProperty('pointer-events');
  }
  document.getElementById('hud')?.style.removeProperty('display');
}
