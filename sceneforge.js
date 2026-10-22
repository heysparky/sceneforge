import { registerSettings } from './core/settings.js';
import { initSocket } from './core/socket.js';
import { registerType } from './core/registry.js';
import { initRenderer } from './core/renderer.js';
import { SceneCreator } from './scenes/picker/SceneTypePicker.js';
import { init as initTokenPlacer } from './scenes/roster/TokenPlacer.js';

Hooks.once('init', () => {
  registerSettings();
  _registerSceneTypes();
});

Hooks.once('ready', () => {
  initSocket();
  initRenderer();
  initTokenPlacer();
  _interceptSceneCreate();
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

function _interceptSceneCreate() {
  Hooks.on('renderSceneDirectory', (_app, html) => {
    if (!game.user.isGM) return;
    const el = html.querySelector ? html : html[0];
    const original = el.querySelector('[data-action="createEntry"]');
    if (!original) {
      console.warn('SceneForge | Could not find Create Scene button — selector may need updating for this Foundry version.');
      return;
    }
    const btn = original.cloneNode(true);
    original.replaceWith(btn);
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      SceneCreator.open().catch(console.error);
    });
  });
}
