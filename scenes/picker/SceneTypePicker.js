import { getAll } from '../../core/registry.js';
import { pickRosterTemplates } from '../roster/RosterConfig.js';

export class SceneCreator {
  static async open() {
    const { DialogV2 } = foundry.applications.api;
    const types = getAll();

    const typeLabelMap = { battlemap: 'Battlemap' };
    for (const t of types) typeLabelMap[t.key] = t.label;
    const defaultName = 'Battlemap';

    const content = await foundry.applications.handlebars.renderTemplate(
      'modules/sceneforge/scenes/picker/picker.html',
      { types, defaultName }
    );

    Hooks.once('renderDialogV2', (_app, element) => {
      const nameInput = element.querySelector('input[name="scene-name"]');
      if (!nameInput) return;
      let autoName = defaultName;
      element.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.addEventListener('change', () => {
          const label = typeLabelMap[radio.value] ?? radio.value;
          if (nameInput.value === autoName) nameInput.value = label;
          autoName = label;
        });
      });
    });

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
      <div style="display:flex;gap:0.5em;align-items:center;">
        <select name="sourceFolder" style="flex:1;">${noneOpt}${options}</select>
        <button type="button" data-create-folder="sourceFolder" title="Create new folder">＋</button>
      </div>
    </div>
    <div class="form-group stacked">
      <label>Destination folder <span class="units">(player copies — leave blank to auto-create "Roster")</span></label>
      <div style="display:flex;gap:0.5em;align-items:center;">
        <select name="destFolder" style="flex:1;">${noneOpt}${options}</select>
        <button type="button" data-create-folder="destFolder" title="Create new folder">＋</button>
      </div>
    </div>
  `;

  Hooks.once('renderDialogV2', (_app, element) => {
    if (!element.querySelector('[data-create-folder]')) return;
    element.querySelectorAll('button[data-create-folder]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selectName = btn.dataset.createFolder;
        const select = element.querySelector(`[name="${selectName}"]`);

        const { DialogV2: DV2 } = foundry.applications.api;
        const promptResult = await DV2.wait({
          window: { title: 'New Actor Folder' },
          content: '<div class="form-group"><input name="folder-name" type="text" placeholder="Folder name" autofocus></div>',
          buttons: [
            {
              action: 'create',
              label: 'Create',
              default: true,
              callback: (_e, _b, d) => ({
                name: d.element.querySelector('[name="folder-name"]')?.value.trim() ?? '',
              }),
            },
            { action: 'cancel', label: 'Cancel', callback: () => null },
          ],
          rejectClose: false,
        });

        if (!promptResult || typeof promptResult !== 'object') return;
        const { name: folderName } = promptResult;
        if (!folderName) { ui.notifications.warn('Please enter a folder name.'); return; }

        const folder = await Folder.create({ name: folderName, type: 'Actor' });
        if (!folder) return;

        const opt = document.createElement('option');
        opt.value = folder.id;
        opt.textContent = folder.name;
        select.appendChild(opt);
        select.value = folder.id;

        if (selectName === 'sourceFolder' && !game.actors.some(a => a.folder?.id === folder.id)) {
          ui.notifications.info(`"${folder.name}" is empty — add template actors to it in the Actors sidebar before continuing.`);
        }
      });
    });
  });

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
