import { loadSceneType } from './registry.js';
import { mountGMControls, unmountGMControls } from './gm-controls.js';

let activeApp = null;
let sfContainer = null;
let boundsObserver = null;
let chromeLeft = 0;
let chromeTop = 0;

export async function onCanvasReady() {
  teardownActive();

  const scene = canvas.scene;
  if (!scene) return;

  const type = scene.getFlag('sceneforge', 'type');
  if (!type) return;

  // Measure chrome BEFORE hiding the canvas — elementFromPoint needs the live board element.
  measureChrome();
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
  chromeLeft = 0;
  chromeTop = 0;
  restoreCanvas();
}

// ── Chrome measurement ────────────────────────────────────────

function measureChrome() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const board = document.getElementById('board');
  chromeLeft = 0;
  chromeTop = 0;

  // In v14, ApplicationV2 panels are appended to body, not inside #ui-left/#ui-top.
  // Don't check containment — just scan until elementFromPoint returns #board (or body/html),
  // meaning we've cleared the chrome and reached the canvas area.
  const isCanvas = el => !el || el === board || el === document.body || el === document.documentElement;

  // Left: scan from x=1 at three heights
  for (const y of [Math.round(h * 0.25), Math.round(h * 0.5), Math.round(h * 0.75)]) {
    for (let x = 1; x < Math.min(w * 0.35, 500); x++) {
      if (isCanvas(document.elementFromPoint(x, y))) break;
      chromeLeft = Math.max(chromeLeft, x);
    }
  }
  if (chromeLeft > 0) chromeLeft++;

  // Top: scan from y=1 at three x positions in the canvas area (past left chrome)
  for (const x of [Math.round(w * 0.4), Math.round(w * 0.5), Math.round(w * 0.6)]) {
    for (let y = 1; y < Math.min(h * 0.35, 400); y++) {
      if (isCanvas(document.elementFromPoint(x, y))) break;
      chromeTop = Math.max(chromeTop, y);
    }
  }
  if (chromeTop > 0) chromeTop++;
}

// ── Bounds tracking ───────────────────────────────────────────

function applyBounds() {
  if (!sfContainer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let right = w, bottom = h;

  // Right and bottom can change (sidebar toggle, resize) — re-read them each time.
  // Left and top are fixed from measureChrome() at activation.
  const sidebarR = document.getElementById('sidebar')?.getBoundingClientRect();
  if (sidebarR && sidebarR.left > w * 0.5 && sidebarR.width > 10) right = sidebarR.left;

  const hotbarR = document.getElementById('hotbar')?.getBoundingClientRect();
  if (hotbarR && hotbarR.top > h * 0.5) bottom = hotbarR.top;

  Object.assign(sfContainer.style, {
    left:   `${chromeLeft}px`,
    top:    `${chromeTop}px`,
    width:  `${Math.max(0, right - chromeLeft)}px`,
    height: `${Math.max(0, bottom - chromeTop)}px`,
  });
}

function startBoundsTracking() {
  applyBounds();

  boundsObserver = new ResizeObserver(applyBounds);
  for (const id of ['sidebar', 'hotbar', 'ui-left', 'ui-top']) {
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
