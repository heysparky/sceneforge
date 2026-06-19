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
    { label: 'Roster', icon: 'fa-users', available: true }
  );
  registerType(
    'merchant',
    () => import('./scenes/merchant/MerchantScene.js'),
    { label: 'Merchant', icon: 'fa-store', available: false }
  );
  registerType(
    'timeline',
    () => import('./scenes/timeline/TimelineScene.js'),
    { label: 'Timeline', icon: 'fa-timeline', available: false }
  );
  registerType(
    'loading',
    () => import('./scenes/loading/LoadingScene.js'),
    { label: 'Loading Screen', icon: 'fa-hourglass', available: false }
  );
}

function _interceptSceneCreate() {
  const SceneDir = ui.scenes?.constructor;
  if (!SceneDir?.DEFAULT_OPTIONS) {
    console.warn('SceneForge | Could not patch SceneDirectory — Foundry API may have changed.');
    return;
  }
  SceneDir.DEFAULT_OPTIONS.actions ??= {};
  SceneDir.DEFAULT_OPTIONS.actions.createEntry = async () => {
    await SceneCreator.open();
  };
}
