import { registerSettings } from './core/settings.js';
import { initSocket } from './core/socket.js';
import { registerType } from './core/registry.js';
import { initRenderer } from './core/renderer.js';
import { SceneCreator } from './scenes/picker/SceneTypePicker.js';
import { init as initTokenPlacer } from './scenes/roster/TokenPlacer.js';

Hooks.once('init', () => {
  registerSettings();
  _registerSceneTypes();
  // Registered early: the Scenes sidebar can render before 'ready', and a hook added
  // later would miss it, leaving Foundry's own Create Scene button in place.
  Hooks.on('renderSceneDirectory', (_app, html) => _patchCreateButton(html));
});

Hooks.once('ready', () => {
  initSocket();
  initRenderer();
  initTokenPlacer();
  // Catch a sidebar that was already rendered before the hook could fire for it.
  if (ui.scenes?.element) _patchCreateButton(ui.scenes.element);
});

function _registerSceneTypes() {
  registerType(
    'roster',
    () => import('./scenes/roster/RosterScene.js'),
    { label: 'SCENEFORGE.Type.Roster', hint: 'SCENEFORGE.Type.RosterHint', icon: 'fa-users', available: true }
  );
  registerType(
    'merchant',
    () => import('./scenes/merchant/MerchantScene.js'),
    { label: 'SCENEFORGE.Type.Merchant', icon: 'fa-store', available: false }
  );
  registerType(
    'timeline',
    () => import('./scenes/timeline/TimelineScene.js'),
    { label: 'SCENEFORGE.Type.Timeline', icon: 'fa-timeline', available: false }
  );
  registerType(
    'loading',
    () => import('./scenes/loading/LoadingScene.js'),
    { label: 'SCENEFORGE.Type.Loading', icon: 'fa-hourglass', available: false }
  );
}

function _patchCreateButton(html) {
  if (!game.user?.isGM) return;
  const el = html?.querySelector ? html : html?.[0];
  const original = el?.querySelector('[data-action="createEntry"]');
  if (!original) {
    console.warn('SceneForge | Could not find Create Scene button — selector may need updating for this Foundry version.');
    return;
  }
  if (original.dataset.sceneforge) return; // already ours
  const btn = original.cloneNode(true);
  btn.dataset.sceneforge = 'create';
  original.replaceWith(btn);
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    SceneCreator.open().catch(console.error);
  });
}
