const GROUP = 'SCENEFORGE.Settings.Roster.Group';

export function registerSettings() {
  game.settings.register('sceneforge', 'rosterEnrollmentOpen', {
    name: 'SCENEFORGE.Settings.Roster.EnrollmentOpen.Name',
    hint: 'SCENEFORGE.Settings.Roster.EnrollmentOpen.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    group: GROUP,
    onChange: () => Hooks.callAll('sceneforge:settingsChanged'),
  });

  game.settings.register('sceneforge', 'rosterOtherPlayerPermission', {
    name: 'SCENEFORGE.Settings.Roster.OtherPlayerPermission.Name',
    hint: 'SCENEFORGE.Settings.Roster.OtherPlayerPermission.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Number,
    default: 1,
    choices: {
      0: 'SCENEFORGE.Settings.Roster.OtherPlayerPermission.None',
      1: 'SCENEFORGE.Settings.Roster.OtherPlayerPermission.Limited',
      2: 'SCENEFORGE.Settings.Roster.OtherPlayerPermission.Observer',
    },
    group: GROUP,
    onChange: () => Hooks.callAll('sceneforge:settingsChanged'),
  });

  game.settings.register('sceneforge', 'rosterShowClaimedBy', {
    name: 'SCENEFORGE.Settings.Roster.ShowClaimedBy.Name',
    hint: 'SCENEFORGE.Settings.Roster.ShowClaimedBy.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    group: GROUP,
    onChange: () => Hooks.callAll('sceneforge:settingsChanged'),
  });
}
