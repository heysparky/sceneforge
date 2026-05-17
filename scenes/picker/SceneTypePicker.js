import { getAll } from '../../core/registry.js';
import { pickRosterTemplates } from '../roster/RosterConfig.js';

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
            try {
              console.log('[SceneForge] picker callback | args:', { _e, _b, dialog });
              const name = dialog.element.querySelector('input[name="scene-name"]')?.value.trim() ?? '';
              const type = dialog.element.querySelector('input[name="type"]:checked')?.value ?? 'battlemap';
              console.log('[SceneForge] picker callback | result:', { name, type });
              return name ? { name, type } : null;
            } catch (err) {
              console.error('[SceneForge] picker callback threw:', err);
              return null;
            }
          },
        },
        { action: 'cancel', label: 'Cancel', callback: () => null },
      ],
      rejectClose: false,
    });

    console.log('[SceneForge] DialogV2 result:', result, typeof result);
    if (!result || typeof result !== 'object') return;

    const { name, type } = result;

    if (type === 'battlemap') {
      await Scene.create({ name }, { renderSheet: true });
    } else {
      const scene = await Scene.create({ name, flags: { sceneforge: { type } } });
      if (type === 'roster') await _configureRoster(scene);
    }
  }
}

async function _configureRoster(scene) {
  const selectedIds = await pickRosterTemplates();
  await scene.setFlag('sceneforge', 'roster', { templates: selectedIds, claims: {} });
}
