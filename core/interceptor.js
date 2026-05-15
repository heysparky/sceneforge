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
  const w = window.innerWidth;
  const h = window.innerHeight;
  let left = 0, top = 0, right = w, bottom = h;

  // #sidebar and #hotbar are the actual chrome elements — use them directly.
  const sidebarR = document.getElementById('sidebar')?.getBoundingClientRect();
  if (sidebarR && sidebarR.left > w * 0.5 && sidebarR.width > 10) right = sidebarR.left;

  const hotbarR = document.getElementById('hotbar')?.getBoundingClientRect();
  if (hotbarR && hotbarR.top > h * 0.5) bottom = hotbarR.top;

  // #ui-left and #ui-top are huge layout zones (not just the chrome strips).
  // Scan their descendants for the actual narrow/short elements anchored to each edge.
  const uiLeft = document.getElementById('ui-left');
  if (uiLeft) {
    for (const el of uiLeft.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.left <= 2 && r.width > 20 && r.width < w * 0.15) left = Math.max(left, r.right);
    }
  }

  const uiTop = document.getElementById('ui-top');
  if (uiTop) {
    for (const el of uiTop.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.top <= 2 && r.height > 20 && r.height < h * 0.15) top = Math.max(top, r.bottom);
    }
  }

  console.log('SceneForge | bounds:', { left, top, right, bottom });
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
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
  for (const id of ['ui-left', 'ui-top', 'sidebar', 'hotbar']) {
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
