const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class RosterGM extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(scene, options = {}) {
    super(options);
    this._scene = scene;
  }

  static DEFAULT_OPTIONS = {
    id: 'sceneforge-roster-gm',
    window: { title: 'Edit Roster', resizable: true },
    position: { width: 560, height: 500 },
  };

  static PARTS = {
    main: { template: 'modules/sceneforge/scenes/roster/roster-gm.html' },
  };

  async _prepareContext(_options) {
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const claims = roster.claims ?? {};

    const actors = (roster.pool ?? [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(entry => ({
        ...entry,
        actor: game.actors.get(entry.actorId),
        claimed: !!claims[entry.actorId],
      }))
      .filter(e => e.actor);

    return { actors };
  }

  _onRender(_context, _options) {
    const el = this.element;

    el.querySelectorAll('[data-description-for]').forEach(input => {
      input.addEventListener('blur', () => this._saveDescription(input.dataset.descriptionFor, input.value));
    });

    el.querySelector('.sf-add-actor-btn')?.addEventListener('click', () => this._openActorPicker());
    el.querySelectorAll('.sf-remove-actor-btn').forEach(btn => {
      btn.addEventListener('click', () => this._removeActor(btn.dataset.actorId));
    });

    this._initDragSort(el);
  }

  async _saveDescription(actorId, value) {
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const pool = (roster.pool ?? []).map(e =>
      e.actorId === actorId ? { ...e, description: value } : e
    );
    await this._scene.setFlag('sceneforge', 'roster', { ...roster, pool });
  }

  async _openActorPicker() {
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const poolIds = new Set((roster.pool ?? []).map(e => e.actorId));
    const available = game.actors.filter(a => a.type === 'character' && !poolIds.has(a.id));

    const opts = available.length
      ? available.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
      : '<option disabled>No available characters</option>';

    const actorId = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Add Character' },
      content: `<select name="actor-id" size="${Math.min(available.length || 1, 8)}"
                        style="width:100%;margin-top:0.5rem">${opts}</select>`,
      buttons: [
        {
          action: 'add',
          label: 'Add to Roster',
          default: true,
          callback: (_event, _button, dialog) =>
            dialog.element.querySelector('[name="actor-id"]')?.value ?? null,
        },
        { action: 'cancel', label: 'Cancel' },
      ],
      rejectClose: false,
    });

    if (actorId) await this._addActor(actorId);
  }

  async _addActor(actorId) {
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const pool = [...(roster.pool ?? [])];
    const maxSort = pool.reduce((m, e) => Math.max(m, e.sortOrder ?? 0), -1);
    pool.push({ actorId, description: '', sortOrder: maxSort + 1 });
    await this._scene.setFlag('sceneforge', 'roster', { ...roster, pool });
    this.render();
  }

  async _removeActor(actorId) {
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const pool = (roster.pool ?? []).filter(e => e.actorId !== actorId);
    await this._scene.setFlag('sceneforge', 'roster', { ...roster, pool });
    this.render();
  }

  _initDragSort(el) {
    let dragId = null;

    el.querySelectorAll('.sf-pool-row[draggable]').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragId = row.dataset.actorId;
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', e => {
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', async e => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const toId = row.dataset.actorId;
        if (!dragId || dragId === toId) return;
        await this._reorder(dragId, toId);
        dragId = null;
      });
    });
  }

  async _reorder(fromId, toId) {
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const pool = [...(roster.pool ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const fromIdx = pool.findIndex(e => e.actorId === fromId);
    const toIdx = pool.findIndex(e => e.actorId === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [item] = pool.splice(fromIdx, 1);
    pool.splice(toIdx, 0, item);
    pool.forEach((e, i) => { e.sortOrder = i; });
    await this._scene.setFlag('sceneforge', 'roster', { ...roster, pool });
    this.render();
  }
}
