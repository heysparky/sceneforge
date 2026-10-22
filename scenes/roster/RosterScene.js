import { SceneForgeScene } from '../SceneForgeScene.js';
import { emit, applyClaim, applyRelease } from '../../core/socket.js';
import { RosterCharManager } from './RosterCharManager.js';
import { editCharacterDossier, sheetBiography } from './RosterCharEdit.js';
import { setPending } from './TokenPlacer.js';

export default class RosterScene extends SceneForgeScene {
  static TYPE = 'roster';

  #isReady = false;
  #focusedId = null;
  #refocus = false;

  static DEFAULT_OPTIONS = {
    id: 'sceneforge-roster',
    classes: ['sceneforge-scene-app', 'sceneforge', 'sceneforge-roster'],
    actions: {
      editCharacters: RosterScene.#onEditCharacters,
      claim:        RosterScene.#onClaim,
      release:      RosterScene.#onRelease,
      kick:         RosterScene.#onKick,
      toggleLock:   RosterScene.#onToggleLock,
      assign:       RosterScene.#onAssign,
      beginSession: RosterScene.#onBeginSession,
      ready:        RosterScene.#onReady,
      openSheet:    RosterScene.#onOpenSheet,
      focus:        RosterScene.#onFocus,
      editDossier:  RosterScene.#onEditDossier,
    },
  };

  static PARTS = {
    main: {
      template: 'modules/sceneforge/scenes/roster/roster.html',
      scrollable: ['.sf-roster__lineup', '.sf-roster__body'],
    },
  };

  async _prepareContext(_options) {
    const user = game.user;
    const roster = this._scene.flags?.sceneforge?.roster ?? {};
    const templates = roster.templates ?? [];
    const claims = roster.claims ?? {};
    const actors = templates.map(id => game.actors.get(id)).filter(Boolean);

    const claimedUserIds = new Set(
      Object.values(claims).map(c => c?.claimedBy).filter(Boolean)
    );
    const activePlayers = game.users.filter(u => u.active && !u.isGM);
    const remaining = activePlayers.filter(u => !claimedUserIds.has(u.id)).length;

    const characters = actors.map(a => this.#toViewModel(a, user, claims));
    const focus = characters.find(c => c.id === this.#focusedId)
      ?? characters.find(c => c.status === 'mine')
      ?? characters.find(c => c.status === 'open')
      ?? characters[0]
      ?? null;
    if (focus) focus.focused = true;
    this.#focusedId = focus?.id ?? null;

    return {
      isGM: user.isGM,
      title: this._scene.name,
      theme: this._scene.flags?.sceneforge?.theme ?? 'default',
      tileMin: RosterScene.#tileMin(characters.length),
      characters,
      focus,
      remaining,
      allClaimed: activePlayers.length > 0 && remaining === 0,
      iHaveClaimed: claimedUserIds.has(user.id),
      isReady: this.#isReady,
    };
  }

  // Fewer characters get bigger portraits; large rosters fall back to a dense grid.
  static #tileMin(count) {
    if (count <= 2)  return 260;
    if (count <= 4)  return 210;
    if (count <= 8)  return 170;
    if (count <= 16) return 140;
    return 116;
  }

  #toViewModel(actor, user, claims) {
    const claim     = claims[actor.id] ?? {};
    const claimedBy = claim.claimedBy ?? null;
    const locked    = actor.getFlag('sceneforge', 'locked') ?? false;
    const d         = this._scene?.flags?.sceneforge?.roster?.dossiers?.[actor.id] ?? {};

    let status;
    if (locked)                     status = 'locked';
    else if (claimedBy === user.id) status = 'mine';
    else if (claimedBy)             status = 'taken';
    else                            status = 'open';

    const i18n = game.i18n;
    const claimedByName = claimedBy ? (game.users.get(claimedBy)?.name ?? '?') : null;

    // Dossier fields: null means "don't render". XP only shows when the GM entered it.
    const concept    = d.showConcept && d.concept ? d.concept : null;
    const level      = d.showLevel   && d.level   ? d.level   : null;
    const xp         = d.showXp !== false && d.xp ? d.xp      : null;
    const background = d.showBackground ? (d.background || sheetBiography(actor)) : null;
    const epithet = [
      concept,
      level ? i18n.format('SCENEFORGE.Roster.Level', { level }) : null,
      xp    ? i18n.format('SCENEFORGE.Roster.Xp',    { xp })    : null,
    ].filter(Boolean).join(' · ');

    const note = {
      mine:   i18n.localize('SCENEFORGE.Roster.NoteYou'),
      taken:  claimedByName,
      locked: i18n.localize('SCENEFORGE.Roster.NoteLocked'),
    }[status] ?? null;

    return {
      id:            actor.id,
      name:          actor.name,
      img:           actor.img,
      ringColor:     actor.prototypeToken?.ring?.colors?.ring ?? null,
      role:          actor.getFlag('sceneforge', 'role') ?? '',
      specialties:   [actor.getFlag('sceneforge', 'specialties') ?? []].flat().join(' · '),
      status,
      note,
      claimedByName,
      canAssign:     status === 'open'  &&  user.isGM,
      canKick:       status === 'taken' &&  user.isGM,
      canClaim:      status === 'open'  && !user.isGM && !this.#isReady,
      canRelease:    status === 'mine'  && !user.isGM && !this.#isReady,
      epithet,
      dBackground:   background || null,
      dQuote:        d.showQuote && d.quote ? d.quote  : null,
      dCustom:       d.custom               ? d.custom : null,
    };
  }

  static #actorIdFrom(target) {
    return target.closest('[data-actor-id]')?.dataset.actorId;
  }

  static async #onClaim(_e, target) {
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId) return;
    if (game.user.isGM) await applyClaim(actorId, game.user.id, this._scene.id);
    else emit({ action: 'claim', actorId, userId: game.user.id, sceneId: this._scene.id });
  }

  static async #onRelease(_e, target) {
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId) return;
    if (game.user.isGM) await applyRelease(actorId, game.user.id, this._scene.id);
    else emit({ action: 'release', actorId, userId: game.user.id, sceneId: this._scene.id });
  }

  static async #onKick(_e, target) {
    if (!game.user.isGM) return;
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId) return;
    const claim = this._scene.flags?.sceneforge?.roster?.claims?.[actorId];
    const claimedBy = claim?.claimedBy;
    if (!claimedBy) return;
    await applyRelease(actorId, claimedBy, this._scene.id);
  }

  static async #onToggleLock(_e, target) {
    if (!game.user.isGM) return;
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId) return;
    const actor = game.actors.get(actorId);
    if (!actor) return;
    await actor.setFlag('sceneforge', 'locked', !actor.getFlag('sceneforge', 'locked'));
  }

  _onRender(context, _options) {
    if (this.#refocus) {
      this.#refocus = false;
      this.element.querySelector('.sf-tile.is-focused .sf-tile__pick')?.focus();
    }
    if (!context.isReady) return;
    const mineTile = this.element.querySelector('.sf-tile--mine');
    mineTile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  static #onFocus(_e, target) {
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId || actorId === this.#focusedId) return;
    this.#focusedId = actorId;
    this.#refocus = true;
    // Re-render through the renderer so scene bounds are re-applied afterwards.
    Hooks.callAll('sceneforge:dataChanged', this._scene.id);
  }

  static async #onEditDossier(_e, target) {
    if (!game.user.isGM) return;
    const actor = game.actors.get(RosterScene.#actorIdFrom(target));
    if (actor) await editCharacterDossier(actor, this._scene);
  }

  static #onEditCharacters(_e, _target) {
    if (!game.user.isGM) return;
    new RosterCharManager(this._scene).render(true);
  }

  static #onOpenSheet(_e, target) {
    const actorId = RosterScene.#actorIdFrom(target);
    game.actors.get(actorId)?.sheet.render(true);
  }

  static async #onAssign(_e, target) {
    if (!game.user.isGM) return;
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId) return;

    const claims = this._scene.flags?.sceneforge?.roster?.claims ?? {};
    const claimedUserIds = new Set(
      Object.values(claims).map(c => c?.claimedBy).filter(Boolean)
    );
    const eligible = game.users.filter(u => u.active && !u.isGM && !claimedUserIds.has(u.id));
    if (!eligible.length) { ui.notifications.warn('No unclaimed players to assign.'); return; }

    const options = eligible.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Assign Character' },
      content: `<div class="form-group stacked"><label>Assign to player</label><select name="userId">${options}</select></div>`,
      buttons: [
        { action: 'assign', label: 'Assign', default: true,
          callback: (_e, _b, dialog) => dialog.element.querySelector('[name="userId"]').value },
        { action: 'cancel', label: 'Cancel', callback: () => null },
      ],
      rejectClose: false,
    });
    if (!result || typeof result !== 'string') return;
    await applyClaim(actorId, result, this._scene.id);
  }

  static async #onBeginSession() {
    if (!game.user.isGM) return;
    const scenes = game.scenes.contents
      .filter(s => s.id !== game.scenes.viewed?.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!scenes.length) { ui.notifications.warn('No other scenes available.'); return; }

    const options = scenes.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Begin Session — Choose Scene' },
      content: `<div class="form-group stacked"><label>Navigate to scene</label><select name="sceneId">${options}</select></div>`,
      buttons: [
        { action: 'view', label: 'Begin Session', default: true,
          callback: (_e, _b, dialog) => dialog.element.querySelector('[name="sceneId"]').value },
        { action: 'cancel', label: 'Cancel', callback: () => null },
      ],
      rejectClose: false,
    });
    if (!result || typeof result !== 'string') return;
    const claims = this._scene.flags?.sceneforge?.roster?.claims ?? {};
    const cloneIds = (this._scene.flags?.sceneforge?.roster?.templates ?? [])
      .map(id => claims[id]?.cloneId)
      .filter(Boolean);
    if (cloneIds.length) setPending(cloneIds, result);
    await game.scenes.get(result)?.view();
  }

  static async #onReady() {
    if (this.#isReady) {
      const claims = this._scene.flags?.sceneforge?.roster?.claims ?? {};
      const templates = this._scene.flags?.sceneforge?.roster?.templates ?? [];
      const actorId = templates.find(id => claims[id]?.claimedBy === game.user.id);
      if (!actorId) return;
      this.#isReady = false;
      if (game.user.isGM) await applyRelease(actorId, game.user.id, this._scene.id);
      else emit({ action: 'release', actorId, userId: game.user.id, sceneId: this._scene.id });
    } else {
      this.#isReady = true;
      Hooks.callAll('sceneforge:dataChanged', this._scene.id);
    }
  }
}
