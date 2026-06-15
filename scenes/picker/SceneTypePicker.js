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
            const name = dialog.element.querySelector('input[name="scene-name"]')?.value.trim() ?? '';
            const type = dialog.element.querySelector('input[name="type"]:checked')?.value ?? 'battlemap';
            return { name, type };
          },
        },
        { action: 'cancel', label: 'Cancel', callback: () => null },
      ],
      rejectClose: false,
    });

    if (!result || typeof result !== 'object') return;

    const { name, type } = result;
    if (!name) { ui.notifications.warn('Please enter a scene name.'); return; }

    if (type === 'battlemap') {
      await Scene.create({ name }, { renderSheet: true });
    } else {
      const scene = await Scene.create({ name, flags: { sceneforge: { type } } });
      if (type === 'roster') await _configureRoster(scene);
    }
  }
}

async function _pickRosterFolders() {
  const { DialogV2 } = foundry.applications.api;
  const actorFolders = game.folders
    .filter(f => f.type === 'Actor')
    .sort((a, b) => a.name.localeCompare(b.name));

  const options = actorFolders.map(f =>
    `<option value="${f.id}">${f.name}</option>`
  ).join('');
  const noneOpt = '<option value="">— none —</option>';

  const content = `
    <div class="form-group stacked">
      <label>Source folder <span class="units">(template actors)</span></label>
      <select name="sourceFolder">${noneOpt}${options}</select>
    </div>
    <div class="form-group stacked">
      <label>Destination folder <span class="units">(player copies — leave blank to auto-create "Roster")</span></label>
      <select name="destFolder">${noneOpt}${options}</select>
    </div>
  `;

  const result = await DialogV2.wait({
    window: { title: 'Configure Roster — Folders' },
    position: { width: 420 },
    content,
    buttons: [
      {
        action: 'next',
        label: 'Next →',
        default: true,
        callback: (_e, _b, dialog) => ({
          sourceFolder: dialog.element.querySelector('[name="sourceFolder"]').value || null,
          destFolder:   dialog.element.querySelector('[name="destFolder"]').value   || null,
        }),
      },
      { action: 'cancel', label: 'Cancel', callback: () => null },
    ],
    rejectClose: false,
  });

  return (!result || typeof result !== 'object') ? null : result;
}

async function _configureRoster(scene) {
  const folders = await _pickRosterFolders();
  if (!folders) return;

  const { sourceFolder, destFolder } = folders;

  let resolvedDest = destFolder;
  if (!resolvedDest) {
    let folder = game.folders.find(f => f.type === 'Actor' && f.name === 'Roster');
    if (!folder) folder = await Folder.create({ name: 'Roster', type: 'Actor' });
    resolvedDest = folder.id;
  }

  const selectedIds = await pickRosterTemplates([], sourceFolder);

  await scene.setFlag('sceneforge', 'roster', {
    templates:    selectedIds,
    sourceFolder: sourceFolder || null,
    destFolder:   resolvedDest,
  });

  if (selectedIds.length) await _grantObserver(selectedIds);
}

async function _grantObserver(actorIds) {
  if (!actorIds.length) return;
  await Actor.updateDocuments(
    actorIds.map(id => ({ _id: id, 'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }))
  );
}
