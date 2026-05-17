import { getAll } from '../../core/registry.js';

export class SceneTypePicker {
  static async open(scene) {
    const { DialogV2 } = foundry.applications.api;
    const currentType = scene.flags?.sceneforge?.type ?? '';
    const types = getAll().map(t => ({ ...t, selected: t.key === currentType }));

    const content = await foundry.applications.handlebars.renderTemplate(
      'modules/sceneforge/scenes/picker/picker.html',
      { types, currentType }
    );

    const selected = await DialogV2.wait({
      window: { title: 'SceneForge Scene Type' },
      content,
      buttons: [
        {
          action: 'set',
          label: 'Set Type',
          default: true,
          callback: (_e, _b, dialog) =>
            dialog.element.querySelector('input[name="type"]:checked')?.value ?? null,
        },
        { action: 'cancel', label: 'Cancel' },
      ],
      rejectClose: false,
    });

    if (selected === null) return;

    if (selected === '') {
      await scene.update({ 'flags.sceneforge.-=type': null });
    } else if (selected !== currentType) {
      await scene.setFlag('sceneforge', 'type', selected);
    }
  }
}
