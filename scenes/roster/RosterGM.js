export default class RosterGM extends Application {
  constructor(scene, options = {}) {
    super(options);
    this._scene = scene;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'sceneforge-roster-gm',
      title: 'Edit Roster',
      template: 'modules/sceneforge/scenes/roster/roster-gm.html',
      width: 560,
      height: 500,
      resizable: true,
    });
  }

  getData() {
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const config = roster.config ?? { enrollmentOpen: true, otherPlayerPermission: 1, showClaimedBy: true };
    const claims = roster.claims ?? {};

    const actors = (roster.pool ?? [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(entry => ({
        ...entry,
        actor: game.actors.get(entry.actorId),
        claimed: !!claims[entry.actorId],
      }))
      .filter(e => e.actor);

    const permissionOptions = [
      { value: 0, label: 'None',     selected: config.otherPlayerPermission === 0 },
      { value: 1, label: 'Limited',  selected: config.otherPlayerPermission === 1 },
      { value: 2, label: 'Observer', selected: config.otherPlayerPermission === 2 },
    ];

    return { actors, config, permissionOptions };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html instanceof jQuery ? html[0] : html;

    el.querySelectorAll('.sf-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.sf-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        el.querySelectorAll('.sf-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === btn.dataset.tab));
      });
    });

    el.querySelector('[name="enrollmentOpen"]')?.addEventListener('change', () => this._saveConfig(el));
    el.querySelector('[name="otherPlayerPermission"]')?.addEventListener('change', () => this._saveConfig(el));
    el.querySelector('[name="showClaimedBy"]')?.addEventListener('change', () => this._saveConfig(el));

    el.querySelectorAll('[data-description-for]').forEach(input => {
      input.addEventListener('blur', () => this._saveDescription(input.dataset.descriptionFor, input.value));
    });

    el.querySelector('.sf-add-actor-btn')?.addEventListener('click', () => this._openActorPicker());

    el.querySelectorAll('.sf-remove-actor-btn').forEach(btn => {
      btn.addEventListener('click', () => this._removeActor(btn.dataset.actorId));
    });

    this._initDragSort(el);
  }

  async _saveConfig(el) {
    const enrollmentOpen = el.querySelector('[name="enrollmentOpen"]')?.checked ?? true;
    const otherPlayerPermission = Number(el.querySelector('[name="otherPlayerPermission"]')?.value ?? 1);
    const showClaimedBy = el.querySelector('[name="showClaimedBy"]')?.checked ?? true;
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    await this._scene.setFlag('sceneforge', 'roster', {
      ...roster,
      config: { enrollmentOpen, otherPlayerPermission, showClaimedBy },
    });
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

    const rows = available.map(a =>
      `<div class="sf-actor-pick" data-id="${a.id}">
        <img src="${a.img}" width="28" height="28">
        <span>${a.name}</span>
      </div>`
    ).join('') || '<p class="sf-picker-empty">No available characters.</p>';

    let picker;
    picker = new Dialog({
      title: 'Add Character',
      content: `<div class="sf-actor-picker">${rows}</div>`,
      buttons: { close: { label: 'Cancel' } },
      render: (html) => {
        const el = html instanceof jQuery ? html[0] : html;
        el.querySelectorAll('.sf-actor-pick').forEach(row => {
          row.addEventListener('click', async () => {
            await this._addActor(row.dataset.id);
            picker.close();
          });
        });
      },
    });
    picker.render(true);
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
