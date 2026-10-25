const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { pickRosterTemplates } from './RosterConfig.js';
import { createRosterFolder } from '../../core/socket.js';

export class RosterCharManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'sceneforge-char-manager',
    classes: ['sceneforge-char-manager'],
    window: { icon: 'fas fa-users', resizable: false },
    position: { width: 480 },
    actions: {
      moveUp:        RosterCharManager.#onMoveUp,
      moveDown:      RosterCharManager.#onMoveDown,
      remove:        RosterCharManager.#onRemove,
      addMore:       RosterCharManager.#onAddMore,
      saveManager:   RosterCharManager.#onSave,
      cancelManager: RosterCharManager.#onCancel,
    },
  };

  // Keys match [data-sf-theme] blocks in sceneforge.css.
  static THEMES = ['default', 'ledger', 'file', 'night'];

  static PARTS = {
    main: { template: 'modules/sceneforge/scenes/roster/charManager.html' },
  };

  #scene = null;
  #templates = [];
  #sourceFolder = null;
  #destFolder   = null;
  #theme        = 'default';

  constructor(scene, options = {}) {
    super(options);
    this.#scene = scene;
    this.#templates     = [...(scene.flags?.sceneforge?.roster?.templates    ?? [])];
    this.#sourceFolder  = scene.flags?.sceneforge?.roster?.sourceFolder ?? null;
    this.#destFolder    = scene.flags?.sceneforge?.roster?.destFolder   ?? null;
    this.#theme         = scene.flags?.sceneforge?.theme ?? 'default';
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
      themes: RosterCharManager.THEMES.map(key => ({ key, label: game.i18n.localize(`SCENEFORGE.Theme.${key}`) })),
      theme:  this.#theme,
    };
  }

  get title() {
    return game.i18n.localize('SCENEFORGE.Manager.Title');
  }

  // The rows in the DOM are the working order; drag, the arrows and remove all just move them.
  _onRender(_context, _options) {
    const list = this.element.querySelector('.sf-char-list');
    let dragged = null;
    list.addEventListener('dragstart', e => {
      dragged = e.target.closest('.sf-char-row');
      if (!dragged) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragged.dataset.actorId);
      dragged.classList.add('is-dragging');
    });
    list.addEventListener('dragover', e => {
      if (!dragged) return;
      e.preventDefault();
      const over = e.target.closest('.sf-char-row');
      if (!over || over === dragged) return;
      const r = over.getBoundingClientRect();
      list.insertBefore(dragged, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
    });
    // Keep the drop to ourselves so Foundry's own drop handlers don't see it.
    list.addEventListener('drop', e => { if (dragged) { e.preventDefault(); e.stopPropagation(); } });
    list.addEventListener('dragend', () => { dragged?.classList.remove('is-dragging'); dragged = null; });
  }

  // Pull unsaved edits back into state before a re-render would replace them.
  #syncFromDom() {
    const el = this.element;
    this.#templates    = [...el.querySelectorAll('.sf-char-row[data-actor-id]')].map(r => r.dataset.actorId);
    this.#sourceFolder = el.querySelector('[name="sourceFolder"]')?.value || null;
    this.#destFolder   = el.querySelector('[name="destFolder"]')?.value   || null;
    this.#theme        = el.querySelector('[name="theme"]')?.value        || 'default';
  }

  static #rowFrom(target) {
    return target.closest('[data-actor-id]');
  }

  static #onMoveUp(_e, target) {
    const row = RosterCharManager.#rowFrom(target);
    const prev = row?.previousElementSibling;
    if (row && prev) row.parentNode.insertBefore(row, prev);
  }

  static #onMoveDown(_e, target) {
    const row = RosterCharManager.#rowFrom(target);
    const next = row?.nextElementSibling;
    if (row && next) row.parentNode.insertBefore(next, row);
  }

  static #onRemove(_e, target) {
    RosterCharManager.#rowFrom(target)?.remove();
  }

  static async #onAddMore() {
    this.#syncFromDom();
    const added = await pickRosterTemplates(this.#templates, this.#sourceFolder);
    if (!added.length) return;
    this.#templates = [...this.#templates, ...added];
    this.render();
  }

  static async #onSave() {
    this.#syncFromDom();
    if (this.#sourceFolder && this.#destFolder && this.#sourceFolder === this.#destFolder) {
      ui.notifications.error('SCENEFORGE.Folders.Same', { localize: true });
      return;
    }
    // A blank (or deleted) destination becomes a new folder now, so the dialog shows its real name next time.
    if (!game.folders.get(this.#destFolder)) this.#destFolder = await createRosterFolder();

    await this.#scene.update({
      'flags.sceneforge.roster.templates':    this.#templates,
      'flags.sceneforge.roster.sourceFolder': this.#sourceFolder,
      'flags.sceneforge.roster.destFolder':   this.#destFolder,
      'flags.sceneforge.theme':               this.#theme,
    });
    this.close();
  }

  static #onCancel() {
    this.close();
  }
}
