import { SceneForgeScene } from '../SceneForgeScene.js';
import { emit } from '../../core/socket.js';

export default class RosterScene extends SceneForgeScene {
  static TYPE = 'roster';

  static DEFAULT_OPTIONS = {
    id: 'sceneforge-roster',
  };

  static PARTS = {
    main: { template: 'modules/sceneforge/scenes/roster/roster.html' },
  };

  async _prepareContext(_options) {
    const ctx = await super._prepareContext(_options);
    const roster = this._scene.flags?.sceneforge?.roster ?? { templates: [], claims: {} };
    const claims = roster.claims ?? {};

    const myClaimActorId = Object.entries(claims)
      .find(([, c]) => c?.userId === game.user.id)?.[0] ?? null;

    const templates = (roster.templates ?? []).map(id => {
      const actor = game.actors.get(id);
      if (!actor) return null;
      const claim = claims[id] ?? null;
      const claimer = claim ? game.users.get(claim.userId) : null;
      const isMine = claim?.userId === game.user.id;
      return {
        id,
        name: actor.name,
        img: actor.img,
        claimed: !!claim,
        claimerName: claimer?.name ?? null,
        isMine,
        canClaim: !claim && !myClaimActorId,
        canRelease: isMine,
      };
    }).filter(Boolean);

    return { ...ctx, templates };
  }

  _onRender(_context, _options) {
    if (game.user.isGM) {
      this.element.querySelector('.sf-add-template')
        ?.addEventListener('click', () => this._addTemplate());
      this.element.querySelector('.sf-reset-all')
        ?.addEventListener('click', () => this._resetAll());
      this.element.querySelectorAll('.sf-reset-claim').forEach(btn =>
        btn.addEventListener('click', () => this._resetClaim(btn.dataset.actorId)));
      this.element.querySelectorAll('.sf-remove-template').forEach(btn =>
        btn.addEventListener('click', () => this._removeTemplate(btn.dataset.actorId)));
    }

    this.element.querySelectorAll('.sf-claim').forEach(btn =>
      btn.addEventListener('click', () => this._claim(btn.dataset.actorId)));
    this.element.querySelectorAll('.sf-release').forEach(btn =>
      btn.addEventListener('click', () => this._release(btn.dataset.actorId)));
  }

  _claim(actorId) {
    emit({
      action: 'sceneforge.roster.claim',
      sceneId: this._scene.id,
      senderId: game.user.id,
      payload: { actorId },
    });
  }

  _release(actorId) {
    emit({
      action: 'sceneforge.roster.release',
      sceneId: this._scene.id,
      senderId: game.user.id,
      payload: { actorId },
    });
  }

  async _addTemplate() {
    const { DialogV2 } = foundry.applications.api;
    const roster = this._scene.flags?.sceneforge?.roster ?? { templates: [], claims: {} };
    const existing = new Set(roster.templates ?? []);
    const candidates = game.actors.filter(a => !existing.has(a.id));

    if (!candidates.length) {
      ui.notifications.warn('No actors available to add.');
      return;
    }

    const options = candidates.map(a =>
      `<option value="${a.id}">${a.name}</option>`).join('');

    const actorId = await DialogV2.wait({
      window: { title: 'Add Template Actor' },
      content: `<select name="actorId" style="width:100%;margin-top:4px">${options}</select>`,
      buttons: [
        {
          action: 'add',
          label: 'Add',
          default: true,
          callback: (_e, _b, d) => d.element.querySelector('select').value,
        },
        { action: 'cancel', label: 'Cancel' },
      ],
      rejectClose: false,
    });

    if (!actorId) return;

    await this._scene.setFlag('sceneforge', 'roster', {
      ...roster,
      templates: [...(roster.templates ?? []), actorId],
    });
    this.render({ force: true });
  }

  async _removeTemplate(actorId) {
    const roster = this._scene.flags?.sceneforge?.roster ?? { templates: [], claims: {} };
    const claim = roster.claims?.[actorId] ?? null;

    if (claim?.cloneId) await game.actors.get(claim.cloneId)?.delete();

    const claims = { ...roster.claims, [actorId]: null };
    await this._scene.setFlag('sceneforge', 'roster', {
      ...roster,
      templates: (roster.templates ?? []).filter(id => id !== actorId),
      claims,
    });
    this.render({ force: true });
  }

  async _resetClaim(actorId) {
    const roster = this._scene.flags?.sceneforge?.roster ?? { templates: [], claims: {} };
    const claim = roster.claims?.[actorId] ?? null;
    if (!claim) return;

    if (claim.cloneId) await game.actors.get(claim.cloneId)?.delete();

    const claims = { ...roster.claims, [actorId]: null };
    await this._scene.setFlag('sceneforge', 'roster', { ...roster, claims });
    this.render({ force: true });
  }

  async _resetAll() {
    const roster = this._scene.flags?.sceneforge?.roster ?? { templates: [], claims: {} };
    const oldClaims = roster.claims ?? {};

    for (const claim of Object.values(oldClaims)) {
      if (claim?.cloneId) await game.actors.get(claim.cloneId)?.delete();
    }

    const claims = Object.fromEntries(Object.keys(oldClaims).map(id => [id, null]));
    await this._scene.setFlag('sceneforge', 'roster', { ...roster, claims, _v: Date.now() });
    this.render({ force: true });
  }
}
