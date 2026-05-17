import { getAll } from '../../core/registry.js';

export class SceneCreator {
  static async open() {
    const { DialogV2 } = foundry.applications.api;
    const types = getAll();

    const content = await foundry.applications.handlebars.renderTemplate(
      'modules/sceneforge/scenes/picker/picker.html',
      { types }
    );

    const result = await DialogV2.wait({
      window: { title: 'Create Scene' },
      content,
      buttons: [
        {
          action: 'create',
          label: 'Create',
          default: true,
          callback: (_e, _b, dialog) => {
            const name = dialog.element.querySelector('input[name="scene-name"]')?.value.trim() ?? '';
            const type = dialog.element.querySelector('input[name="type"]:checked')?.value ?? 'battlemap';
            return name ? { name, type } : null;
          },
        },
        { action: 'cancel', label: 'Cancel' },
      ],
      rejectClose: false,
    });

    if (!result) return;

    const { name, type } = result;

    if (type === 'battlemap') {
      await Scene.create({ name }, { renderSheet: true });
    } else {
      await Scene.create({ name, flags: { sceneforge: { type } } });
    }
  }
}
