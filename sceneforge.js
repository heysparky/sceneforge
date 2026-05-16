import { registerSettings } from './core/settings.js';
import { initSocket } from './core/socket.js';

Hooks.once('init', () => {
  registerSettings();
});

Hooks.once('ready', () => {
  initSocket();
});
