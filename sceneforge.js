import { registerSettings } from './core/settings.js';
import { initSocket } from './core/socket.js';
import { registerType } from './core/registry.js';
import { initRenderer } from './core/renderer.js';
import { SceneTypePicker } from './scenes/picker/SceneTypePicker.js';

Hooks.once('init', () => {
  registerSettings();
  _registerSceneTypes();
});

Hooks.once('ready', () => {
  initSocket();
  initRenderer();
  _addSceneDirectoryButton();
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

function _addSceneDirectoryButton() {
  Hooks.on('renderSceneDirectory', (_app, html) => {
    if (!game.user.isGM) return;
    const el = html.querySelector ? html : html[0];
    el.querySelectorAll('[data-document-id]').forEach(entry => {
      const scene = game.scenes.get(entry.dataset.documentId);
      if (!scene) return;
      const type = scene.flags?.sceneforge?.type;
      const btn = document.createElement('a');
      btn.className = 'sceneforge-dir-btn' + (type ? ' sf-active' : '');
      btn.title = type ? `SceneForge: ${type}` : 'Set SceneForge Type';
      btn.innerHTML = '<i class="fa-solid fa-masks-theater"></i>';
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        SceneTypePicker.open(scene);
      });
      entry.querySelector('.document-name')?.after(btn);
    });
  });
}
