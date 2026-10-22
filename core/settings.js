// Panel sections a GM can show or hide. World scope: the GM's choice applies to every client.
export const ROSTER_FIELDS = ['Class', 'Xp', 'Biography', 'Skills', 'Carrying', 'Statuses'];

const rerender = () => Hooks.callAll('sceneforge:dataChanged', game.scenes.viewed?.id);

export function registerSettings() {
  game.settings.register('sceneforge', 'rosterClassPath', {
    name:    'SCENEFORGE.Settings.ClassPath.Name',
    hint:    'SCENEFORGE.Settings.ClassPath.Hint',
    scope:   'world',
    config:  true,
    type:    String,
    default: '',
    onChange: rerender,
  });

  for (const field of ROSTER_FIELDS) {
    game.settings.register('sceneforge', `rosterShow${field}`, {
      name:    `SCENEFORGE.Settings.Show${field}.Name`,
      hint:    `SCENEFORGE.Settings.Show${field}.Hint`,
      scope:   'world',
      config:  true,
      type:    Boolean,
      default: true,
      onChange: rerender,
    });
  }
}

// { Class: true, Xp: false, … } for the current world.
export function rosterFieldsShown() {
  return Object.fromEntries(ROSTER_FIELDS.map(f => [f, game.settings.get('sceneforge', `rosterShow${f}`)]));
}
