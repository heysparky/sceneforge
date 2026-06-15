import { SceneForgeScene } from '../SceneForgeScene.js';
import { emit, applyClaim, applyRelease } from '../../core/socket.js';
import { pickRosterTemplates } from './RosterConfig.js';

export default class RosterScene extends SceneForgeScene {
  static TYPE = 'roster';

  static DEFAULT_OPTIONS = {
    id: 'sceneforge-roster',
    classes: ['sceneforge-scene-app', 'sceneforge', 'sceneforge-roster'],
    actions: {
      addItems:         RosterScene.#onAddItems,
      claim:            RosterScene.#onClaim,
      release:          RosterScene.#onRelease,
      toggleLock:       RosterScene.#onToggleLock,
      beginSession:     RosterScene.#onBeginSession,
      assignCharacters: RosterScene.#onAssignCharacters,
      ready:            RosterScene.#onReady,
    },
  };

  static PARTS = {
    main: { template: 'modules/sceneforge/scenes/roster/roster.html' },
  };

  async _prepareContext(_options) {
    const user = game.user;
    const templates = this._scene.flags?.sceneforge?.roster?.templates ?? [];
    const actors = templates.map(id => game.actors.get(id)).filter(Boolean);

    const claimedUserIds = new Set(
      actors.map(a => a.getFlag('sceneforge', 'claimedBy')).filter(Boolean)
    );
    const activePlayers = game.users.filter(u => u.active && !u.isGM);
    const remaining = activePlayers.filter(u => !claimedUserIds.has(u.id)).length;

    return {
      isGM: user.isGM,
      characters: actors.map(a => this.#toViewModel(a, user)),
      remaining,
      allClaimed: activePlayers.length > 0 && remaining === 0,
      iHaveClaimed: claimedUserIds.has(user.id),
    };
  }

  #toViewModel(actor, user) {
    const claimedBy = actor.getFlag('sceneforge', 'claimedBy') ?? null;
    const locked    = actor.getFlag('sceneforge', 'locked') ?? false;

    const root  = actor.system.skills?.find(s => s.id === 'root');
    const level = root?.level ?? 1;

    let status;
    if (locked)                  status = 'locked';
    else if (claimedBy === user.id) status = 'mine';
    else if (claimedBy)          status = 'taken';
    else                         status = 'open';

    return {
      id:            actor.id,
      name:          actor.name,
      img:           actor.img,
      ringColor:     actor.prototypeToken?.ring?.colors?.ring ?? '#ffffff',
      role:          actor.getFlag('sceneforge', 'role') ?? '',
      specialties:   actor.getFlag('sceneforge', 'specialties') ?? [],
      bio:           actor.system.biography ?? '',
      dice:          `${level}d6`,
      xp:            actor.system.xp ?? 0,
      inventory:     actor.system.inventory ?? [],
      status,
      statusLabel:   RosterScene.#statusLabel(status),
      claimedByName: claimedBy ? (game.users.get(claimedBy)?.name ?? '?') : null,
      canClaim:      status === 'open',
      canRelease:    status === 'mine',
    };
  }

  static #statusLabel(status) {
    return {
      open:   game.i18n.localize('SCENEFORGE.Status.Open'),
      mine:   game.i18n.localize('SCENEFORGE.Status.You'),
      taken:  game.i18n.localize('SCENEFORGE.Status.Taken'),
      locked: game.i18n.localize('SCENEFORGE.Status.GMOnly'),
    }[status];
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
    if (game.user.isGM) await applyRelease(actorId, game.user.id);
    else emit({ action: 'release', actorId, userId: game.user.id });
  }

  static async #onToggleLock(_e, target) {
    if (!game.user.isGM) return;
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId) return;
    const actor = game.actors.get(actorId);
    if (!actor) return;
    await actor.setFlag('sceneforge', 'locked', !actor.getFlag('sceneforge', 'locked'));
  }

  static async #onAddItems(_e, _target) {
    if (!game.user.isGM) return;
    const scene = this._scene;
    const current = scene.flags?.sceneforge?.roster?.templates ?? [];
    const added = await pickRosterTemplates(current);
    if (!added.length) return;
    await scene.update({ 'flags.sceneforge.roster.templates': [...current, ...added] });
    await Actor.updateDocuments(
      added.map(id => ({ _id: id, 'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }))
    );
  }

  static #onBeginSession() {
    console.log('SceneForge | Begin Session — not yet implemented');
  }

  static #onAssignCharacters() {
    console.log('SceneForge | Assign Characters — not yet implemented');
  }

  static #onReady() {
    console.log('SceneForge | Player ready — not yet implemented');
  }
}
