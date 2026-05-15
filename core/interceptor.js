import { loadSceneType } from './registry.js';
import { mountGMControls, unmountGMControls } from './gm-controls.js';
import { cleanupStaleClaimsForScene } from './cleanup.js';

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

  await cleanupStaleClaimsForScene(scene);

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
  chromeLeft = 0;
  chromeTop = 0;

  // Scan every element in the DOM — no class or ID assumptions.
  // The geometry filters are narrow enough to catch only actual chrome panels.
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // Left panel: right edge is within the left 30% of screen, tall enough to be a panel,
    // and positioned in the top half (excludes players list, hotbar, etc.)
    if (r.right > 10 && r.right < w * 0.3 && r.height > 80 && r.top < h * 0.5) {
      chromeLeft = Math.max(chromeLeft, r.right);
    }

    // Top panel: touches top edge, shorter than 20% of screen, wider than 200px
    if (r.top <= 2 && r.height > 10 && r.height < h * 0.2 && r.width > 200) {
      chromeTop = Math.max(chromeTop, r.bottom);
    }
  }
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
