import { getAll } from '../../core/registry.js';
import { pickRosterTemplates } from '../roster/RosterConfig.js';
import { createRosterFolder } from '../../core/socket.js';

const esc = s => Handlebars.escapeExpression(s);

export class SceneCreator {
  static async open() {
    const { DialogV2 } = foundry.applications.api;
    const i18n = game.i18n;

    // Only types that can actually be made; unbuilt ones stay out of sight.
    const types = [
      { key: 'battlemap', label: i18n.localize('SCENEFORGE.Type.Battlemap'), hint: i18n.localize('SCENEFORGE.Type.BattlemapHint'), icon: 'fa-map' },
      ...getAll()
        .filter(t => t.available)
        .map(t => ({ key: t.key, label: i18n.localize(t.label), hint: t.hint ? i18n.localize(t.hint) : '', icon: t.icon })),
    ];
    const typeLabelMap = Object.fromEntries(types.map(t => [t.key, t.label]));
    const defaultName = types[0].label;

    const content = await foundry.applications.handlebars.renderTemplate(
      'modules/sceneforge/scenes/picker/picker.html',
      { types, defaultName }
    );

    // Keep the name in step with the chosen type until the GM types their own.
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
      window: { title: i18n.localize('SCENEFORGE.Create.Title') },
      position: { width: 440 },
      content,
      buttons: [
        {
          action: 'create',
          label: i18n.localize('SCENEFORGE.Create.Create'),
          default: true,
          callback: (_e, _b, dialog) => {
            const name = dialog.element.querySelector('input[name="scene-name"]')?.value.trim() ?? '';
            const type = dialog.element.querySelector('input[name="type"]:checked')?.value ?? 'battlemap';
            return { name, type };
          },
        },
        { action: 'cancel', label: i18n.localize('SCENEFORGE.Cancel'), callback: () => null },
      ],
      rejectClose: false,
    });

    if (!result || typeof result !== 'object') return;

    const { name, type } = result;
    if (!name) { ui.notifications.warn('SCENEFORGE.Create.NeedName', { localize: true }); return; }

    if (type === 'battlemap') {
      await Scene.create({ name }, { renderSheet: true });
    } else {
      // SceneForge scenes hide the map, so token vision only produces a spurious
      // "no token" warning for players.
      const scene = await Scene.create({ name, tokenVision: false, flags: { sceneforge: { type } } });
      if (type === 'roster') await _configureRoster(scene);
    }
  }
}

async function _pickRosterFolders() {
  const { DialogV2 } = foundry.applications.api;
  const i18n = game.i18n;
  const actorFolders = game.folders
    .filter(f => f.type === 'Actor')
    .sort((a, b) => a.name.localeCompare(b.name));

  const options = actorFolders.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
  const newFolderBtn = target => `
    <button type="button" class="sf-folder-new" data-create-folder="${target}"
            data-tooltip="${esc(i18n.localize('SCENEFORGE.Folders.New'))}" aria-label="${esc(i18n.localize('SCENEFORGE.Folders.New'))}">
      <i class="fas fa-folder-plus" inert></i>
    </button>`;

  const content = `
    <div class="form-group stacked">
      <label>${esc(i18n.localize('SCENEFORGE.Folders.Source'))}</label>
      <div class="sf-folder-row">
        <select name="sourceFolder"><option value="">${esc(i18n.localize('SCENEFORGE.Folders.SourceAll'))}</option>${options}</select>
        ${newFolderBtn('sourceFolder')}
      </div>
    </div>
    <div class="form-group stacked">
      <label>${esc(i18n.localize('SCENEFORGE.Folders.Dest'))}</label>
      <div class="sf-folder-row">
        <select name="destFolder"><option value="">${esc(i18n.localize('SCENEFORGE.Folders.DestNew'))}</option>${options}</select>
        ${newFolderBtn('destFolder')}
      </div>
    </div>
  `;

  Hooks.once('renderDialogV2', (_app, element) => {
    if (!element.querySelector('[data-create-folder]')) return;
    element.querySelectorAll('button[data-create-folder]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selectName = btn.dataset.createFolder;
        const select = element.querySelector(`[name="${selectName}"]`);

        const promptResult = await DialogV2.wait({
          window: { title: i18n.localize('SCENEFORGE.Folders.NewTitle') },
          content: `<div class="form-group"><input name="folder-name" type="text" placeholder="${esc(i18n.localize('SCENEFORGE.Folders.NewPlaceholder'))}" autofocus></div>`,
          buttons: [
            {
              action: 'create',
              label: i18n.localize('SCENEFORGE.Create.Create'),
              default: true,
              callback: (_e, _b, d) => ({
                name: d.element.querySelector('[name="folder-name"]')?.value.trim() ?? '',
              }),
            },
            { action: 'cancel', label: i18n.localize('SCENEFORGE.Cancel'), callback: () => null },
          ],
          rejectClose: false,
        });

        if (!promptResult || typeof promptResult !== 'object') return;
        const { name: folderName } = promptResult;
        if (!folderName) { ui.notifications.warn('SCENEFORGE.Folders.NeedName', { localize: true }); return; }

        const folder = await Folder.create({ name: folderName, type: 'Actor' });
        if (!folder) return;

        const opt = document.createElement('option');
        opt.value = folder.id;
        opt.textContent = folder.name;
        select.appendChild(opt);
        select.value = folder.id;

        if (selectName === 'sourceFolder' && !game.actors.some(a => a.folder?.id === folder.id)) {
          ui.notifications.info(i18n.format('SCENEFORGE.Folders.Empty', { name: folder.name }));
        }
      });
    });
  });

  const result = await DialogV2.wait({
    window: { title: i18n.localize('SCENEFORGE.Folders.Title') },
    position: { width: 420 },
    content,
    buttons: [
      {
        action: 'next',
        label: i18n.localize('SCENEFORGE.Folders.Next'),
        icon: 'fas fa-arrow-right',
        default: true,
        callback: (_e, _b, dialog) => ({
          sourceFolder: dialog.element.querySelector('[name="sourceFolder"]').value || null,
          destFolder:   dialog.element.querySelector('[name="destFolder"]').value   || null,
        }),
      },
      { action: 'cancel', label: i18n.localize('SCENEFORGE.Cancel'), callback: () => null },
    ],
    rejectClose: false,
  });

  return (!result || typeof result !== 'object') ? null : result;
}

async function _configureRoster(scene) {
  const folders = await _pickRosterFolders();
  if (!folders) return;

  const { sourceFolder, destFolder } = folders;

  if (sourceFolder && destFolder && sourceFolder === destFolder) {
    ui.notifications.error('SCENEFORGE.Folders.Same', { localize: true });
    await scene.delete();
    return;
  }

  const resolvedDest = destFolder || await createRosterFolder();

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
