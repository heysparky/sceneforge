import './scenes/roster/index.js';
import './scenes/merchant/index.js';
import { onCanvasReady } from './core/interceptor.js';
import { openSceneCreator } from './ui/scene-creator.js';
import { registerSettings } from './core/settings.js';

Hooks.once('init', () => {
  registerSettings();
  Hooks.on('canvasReady', onCanvasReady);

  Hooks.on('renderSceneDirectory', (_app, html) => {
    if (!game.user.isGM) return;
    const el = html.querySelector ? html : html[0];
    const actions = el.querySelector('.directory-header .header-actions');
    if (!actions || actions.querySelector('.sceneforge-create-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sceneforge-create-btn';
    btn.title = game.i18n.localize('SCENEFORGE.SceneCreator.ButtonLabel');
    btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
    btn.addEventListener('click', openSceneCreator);
    actions.prepend(btn);
  });
});

Hooks.once('ready', () => {
  // Placeholder — full socket handling in Milestone 2
  game.socket.on('module.sceneforge', () => {});
});
