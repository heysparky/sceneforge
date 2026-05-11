const { DialogV2 } = foundry.applications.api;

export async function openSceneCreator() {
  const content = await foundry.applications.handlebars.renderTemplate('modules/sceneforge/ui/scene-creator.html', {
    types: [
      { id: 'roster', label: game.i18n.localize('SCENEFORGE.SceneTypes.roster.Label') },
      { id: 'merchant', label: game.i18n.localize('SCENEFORGE.SceneTypes.merchant.Label') },
    ],
  });

  const result = await DialogV2.wait({
    window: { title: game.i18n.localize('SCENEFORGE.SceneCreator.Title') },
    content,
    buttons: [
      {
        action: 'create',
        label: game.i18n.localize('SCENEFORGE.SceneCreator.Create'),
        default: true,
        callback: (_event, _button, dialog) => ({
          type: dialog.element.querySelector('[name="scene-type"]').value,
          name: dialog.element.querySelector('[name="scene-name"]').value.trim(),
        }),
      },
      { action: 'cancel', label: 'Cancel' },
    ],
    rejectClose: false,
  });

  if (!result) return;
  const { type, name: rawName } = result;
  const name = rawName || game.i18n.localize(`SCENEFORGE.SceneTypes.${type}.DefaultName`);
  await Scene.create({ name, flags: { sceneforge: { type, version: '1.0.0' } } });
}
