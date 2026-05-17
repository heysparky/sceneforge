export function registerSettings() {
  game.settings.register('sceneforge', 'sceneBounds', {
    scope: 'client',
    config: false,
    type: Object,
    default: { top: 25, left: 25, right: 25, bottom: 25 },
  });
}
