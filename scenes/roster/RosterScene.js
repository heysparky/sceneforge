import { SceneForgeScene } from '../SceneForgeScene.js';
import { emit, applyClaim, applyRelease } from '../../core/socket.js';
import { RosterCharManager } from './RosterCharManager.js';

export default class RosterScene extends SceneForgeScene {
  static TYPE = 'roster';

  #isReady = false;
  #_ro = null;

  static DEFAULT_OPTIONS = {
    id: 'sceneforge-roster',
    classes: ['sceneforge-scene-app', 'sceneforge', 'sceneforge-roster'],
    actions: {
      editCharacters: RosterScene.#onEditCharacters,
      claim:        RosterScene.#onClaim,
      release:      RosterScene.#onRelease,
      toggleLock:   RosterScene.#onToggleLock,
      assign:       RosterScene.#onAssign,
      beginSession: RosterScene.#onBeginSession,
      ready:        RosterScene.#onReady,
      openSheet:    RosterScene.#onOpenSheet,
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
      isReady: this.#isReady,
    };
  }

  #toViewModel(actor, user) {
    const claimedBy = actor.getFlag('sceneforge', 'claimedBy') ?? null;
    const locked    = actor.getFlag('sceneforge', 'locked') ?? false;
    const d         = actor.getFlag('sceneforge', 'dossier') ?? {};

    let status;
    if (locked)                     status = 'locked';
    else if (claimedBy === user.id) status = 'mine';
    else if (claimedBy)             status = 'taken';
    else                            status = 'open';

    const xpVal = d.xp ? Number(d.xp) : (actor.system?.xp ?? 0);

    return {
      id:            actor.id,
      name:          actor.name,
      img:           actor.img,
      ringColor:     actor.prototypeToken?.ring?.colors?.ring ?? '#ffffff',
      role:          actor.getFlag('sceneforge', 'role') ?? '',
      specialties:   actor.getFlag('sceneforge', 'specialties') ?? [],
      status,
      statusLabel:   RosterScene.#statusLabel(status),
      claimedByName: claimedBy ? (game.users.get(claimedBy)?.name ?? '?') : null,
      canAssign:     status === 'open'  &&  user.isGM,
      canClaim:      status === 'open'  && !user.isGM && !this.#isReady,
      canRelease:    status === 'mine'  && !user.isGM && !this.#isReady,
      // dossier fields — null means "don't render"
      dConcept:    d.showConcept    && d.concept                            ? d.concept                            : null,
      dLevel:      d.showLevel      && d.level                              ? d.level                              : null,
      dXp:         d.showXp !== false                                       ? String(xpVal)                        : null,
      dBackground: d.showBackground && (d.background || actor.system?.biography)
                     ? (d.background || actor.system?.biography)           : null,
      dQuote:      d.showQuote      && d.quote                              ? d.quote                              : null,
      dCustom:     d.custom                                                 ? d.custom                             : null,
    };
  }

  static #statusLabel(status) {
    return {
      open:   game.i18n.localize('SCENEFORGE.Status.Available'),
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

  _onRender(context, _options) {
    this.#initFade();
    if (!context.isReady) return;
    const mineTile = this.element.querySelector('.sf-tile--mine');
    mineTile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  #initFade() {
    const scroller = this.element.querySelector('.sf-roster__scroller');
    const fadeL = this.element.querySelector('.sf-roster__fade--left');
    const fadeR = this.element.querySelector('.sf-roster__fade--right');
    if (!scroller || !fadeL || !fadeR) return;

    const measure = () => {
      const atStart = scroller.scrollLeft <= 4;
      const atEnd = scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 1;
      fadeL.classList.toggle('sf-roster__fade--hidden', atStart);
      fadeR.classList.toggle('sf-roster__fade--hidden', atEnd);
    };

    if (this.#_ro) this.#_ro.disconnect();
    scroller.onscroll = measure;
    this.#_ro = new ResizeObserver(measure);
    this.#_ro.observe(scroller);
    measure();
  }

  async close(options) {
    if (this.#_ro) { this.#_ro.disconnect(); this.#_ro = null; }
    return super.close(options);
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

    const templates = this._scene.flags?.sceneforge?.roster?.templates ?? [];
    const claimedUserIds = new Set(
      templates.map(id => game.actors.get(id)?.getFlag('sceneforge', 'claimedBy')).filter(Boolean)
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
    await game.scenes.get(result)?.view();
  }

  static async #onReady() {
    if (this.#isReady) {
      const templates = this._scene.flags?.sceneforge?.roster?.templates ?? [];
      const actorId = templates.find(id =>
        game.actors.get(id)?.getFlag('sceneforge', 'claimedBy') === game.user.id
      );
      if (!actorId) return;
      this.#isReady = false;
      if (game.user.isGM) await applyRelease(actorId, game.user.id);
      else emit({ action: 'release', actorId, userId: game.user.id });
    } else {
      this.#isReady = true;
      Hooks.callAll('sceneforge:dataChanged', this._scene.id);
    }
  }
}
