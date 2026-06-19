const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { pickRosterTemplates } from './RosterConfig.js';
import { editCharacterDossier } from './RosterCharEdit.js';

export class RosterCharManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'sceneforge-char-manager',
    classes: ['sceneforge-char-manager'],
    window: { title: 'Edit Roster', resizable: false },
    position: { width: 480 },
    actions: {
      moveUp:        RosterCharManager.#onMoveUp,
      moveDown:      RosterCharManager.#onMoveDown,
      remove:        RosterCharManager.#onRemove,
      addMore:       RosterCharManager.#onAddMore,
      editDossier:   RosterCharManager.#onEditDossier,
      saveManager:   RosterCharManager.#onSave,
      cancelManager: RosterCharManager.#onCancel,
    },
  };

  static PARTS = {
    main: { template: 'modules/sceneforge/scenes/roster/charManager.html' },
  };

  #scene = null;
  #templates = [];
  #sourceFolder = null;
  #destFolder   = null;

  constructor(scene, options = {}) {
    super(options);
    this.#scene = scene;
    this.#templates     = [...(scene.flags?.sceneforge?.roster?.templates    ?? [])];
    this.#sourceFolder  = scene.flags?.sceneforge?.roster?.sourceFolder ?? null;
    this.#destFolder    = scene.flags?.sceneforge?.roster?.destFolder   ?? null;
  }

  async _prepareContext(_options) {
    const allFolders = game.folders
      .filter(f => f.type === 'Actor')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => ({ id: f.id, name: f.name }));
    return {
      characters: this.#templates
        .map(id => game.actors.get(id))
        .filter(Boolean)
        .map(a => ({ id: a.id, name: a.name, img: a.img })),
      allFolders,
      sourceFolder: this.#sourceFolder ?? '',
      destFolder:   this.#destFolder   ?? '',
    };
  }

  static #rowFrom(target) {
    return target.closest('[data-actor-id]');
  }

  static #onMoveUp(_e, target) {
    const row = RosterCharManager.#rowFrom(target);
    const prev = row?.previousElementSibling;
    if (!row || !prev) return;
    row.parentNode.insertBefore(row, prev);
    const i = this.#templates.indexOf(row.dataset.actorId);
    if (i > 0) [this.#templates[i - 1], this.#templates[i]] = [this.#templates[i], this.#templates[i - 1]];
  }

  static #onMoveDown(_e, target) {
    const row = RosterCharManager.#rowFrom(target);
    const next = row?.nextElementSibling;
    if (!row || !next) return;
    row.parentNode.insertBefore(next, row);
    const i = this.#templates.indexOf(row.dataset.actorId);
    if (i >= 0 && i < this.#templates.length - 1)
      [this.#templates[i], this.#templates[i + 1]] = [this.#templates[i + 1], this.#templates[i]];
  }

  static #onRemove(_e, target) {
    const row = RosterCharManager.#rowFrom(target);
    if (!row) return;
    this.#templates = this.#templates.filter(id => id !== row.dataset.actorId);
    row.remove();
  }

  static async #onAddMore() {
    const sourceFolder = this.element.querySelector('[name="sourceFolder"]')?.value || null;
    const added = await pickRosterTemplates(this.#templates, sourceFolder);
    if (!added.length) return;
    this.#templates = [...this.#templates, ...added];
    const list = this.element.querySelector('#sf-char-list');
    for (const id of added) {
      const actor = game.actors.get(id);
      if (!actor) continue;
      list.insertAdjacentHTML('beforeend', RosterCharManager.#buildRow(actor));
    }
  }

  static #buildRow(actor) {
    return `<div class="sf-char-row" data-actor-id="${actor.id}">
      <div class="sf-char-row__move">
        <button type="button" class="sf-icon-btn" data-action="moveUp" title="Move up">↑</button>
        <button type="button" class="sf-icon-btn" data-action="moveDown" title="Move down">↓</button>
      </div>
      <img class="sf-char-row__img" src="${actor.img}" alt="${actor.name}">
      <span class="sf-char-row__name">${actor.name}</span>
      <div class="sf-char-row__btns">
        <button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" data-action="editDossier">Dossier</button>
        <button type="button" class="sf-icon-btn sf-icon-btn--remove" data-action="remove" title="Remove">✕</button>
      </div>
    </div>`;
  }

  static async #onEditDossier(_e, target) {
    const row = RosterCharManager.#rowFrom(target);
    if (!row) return;
    const actor = game.actors.get(row.dataset.actorId);
    if (!actor) return;
    await editCharacterDossier(actor, this.#scene);
  }

  static async #onSave() {
    const ids          = [...this.element.querySelectorAll('.sf-char-row[data-actor-id]')]
      .map(el => el.dataset.actorId);
    const sourceFolder = this.element.querySelector('[name="sourceFolder"]')?.value || null;
    const destFolder   = this.element.querySelector('[name="destFolder"]')?.value   || null;

    if (sourceFolder && destFolder && sourceFolder === destFolder) {
      ui.notifications.error('Source folder and destination folder cannot be the same.');
      return;
    }

    await this.#scene.update({
      'flags.sceneforge.roster.templates':    ids,
      'flags.sceneforge.roster.sourceFolder': sourceFolder,
      'flags.sceneforge.roster.destFolder':   destFolder,
    });
    this.close();
  }

  static #onCancel() {
    this.close();
  }
}
