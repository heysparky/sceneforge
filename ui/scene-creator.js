export async function openSceneCreator() {
  const content = await foundry.applications.handlebars.renderTemplate('modules/sceneforge/ui/scene-creator.html', {
    types: [
      { id: 'roster', label: game.i18n.localize('SCENEFORGE.SceneTypes.roster.Label') },
      { id: 'merchant', label: game.i18n.localize('SCENEFORGE.SceneTypes.merchant.Label') },
    ],
  });

  new Dialog({
    title: game.i18n.localize('SCENEFORGE.SceneCreator.Title'),
    content,
    buttons: {
      create: {
        label: game.i18n.localize('SCENEFORGE.SceneCreator.Create'),
        callback: async (html) => {
          const el = html.querySelector ? html : html[0];
          const type = el.querySelector('[name="scene-type"]').value;
          const name = el.querySelector('[name="scene-name"]').value.trim()
            || game.i18n.localize(`SCENEFORGE.SceneTypes.${type}.DefaultName`);
          await Scene.create({
            name,
            flags: { sceneforge: { type, version: '1.0.0' } },
          });
        },
      },
      cancel: { label: 'Cancel' },
    },
    default: 'create',
  }).render(true);
}
