import { SceneForgeScene } from '../SceneForgeScene.js';
import { emit, applyClaim, applyRelease } from '../../core/socket.js';
import { RosterCharManager } from './RosterCharManager.js';
import { sheetSummary } from './sheetSummary.js';
import { rosterFieldsShown } from '../../core/settings.js';
import { setPending } from './TokenPlacer.js';

export default class RosterScene extends SceneForgeScene {
  static TYPE = 'roster';

  #lastClaims = null;      // actorId → userId at the previous render, to spot new claims
  #flourishes = new Map(); // actorId → { userId, start } for claims still animating
  #lastPick = { actorId: null, at: 0 }; // for double-click → sheet across re-renders
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
      openSheet:    RosterScene.#onOpenSheet,
      focus:        RosterScene.#onFocus,
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

    const shown = rosterFieldsShown();
    const classPath = game.settings.get('sceneforge', 'rosterClassPath').trim();
    const characters = actors.map(a => this.#toViewModel(a, user, claims, shown, classPath));
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
      party: this.#partySeats(claims, user),
      // Online players without a character here: the GM's assign targets.
      unseated: activePlayers
        .filter(u => !claimedUserIds.has(u.id))
        .map(u => ({ id: u.id, name: u.name, color: u.color?.css ?? String(u.color ?? '') })),
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

  #toViewModel(actor, user, claims, shown, classPath) {
    const claim     = claims[actor.id] ?? {};
    const claimedBy = claim.claimedBy ?? null;
    const locked    = actor.getFlag('sceneforge', 'locked') ?? false;

    let status;
    if (locked)                     status = 'locked';
    else if (claimedBy === user.id) status = 'mine';
    else if (claimedBy)             status = 'taken';
    else                            status = 'open';

    const i18n = game.i18n;
    const claimedByName = claimedBy ? (game.users.get(claimedBy)?.name ?? '?') : null;

    // Everything about the character comes from the sheet, so the roster can't drift from it.
    const sheet = sheetSummary(actor, shown, classPath);

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
      status,
      note,
      claimedByName,
      canAssign:     status === 'open'  &&  user.isGM,
      canKick:       status === 'taken' &&  user.isGM,
      canClaim:      status === 'open'  && !user.isGM,
      canRelease:    status === 'mine'  && !user.isGM,
      epithet:       [sheet.className, sheet.xp ? i18n.format('SCENEFORGE.Roster.Xp', { xp: sheet.xp }) : '']
                       .filter(Boolean).join(' · '),
      biography:     sheet.biography,
      skills:        sheet.skills,
      carrying:      sheet.carrying,
      statuses:      sheet.statuses,
    };
  }

  // Token art as it appears on the map: the dynamic-ring subject if a ring is on, else the token image.
  static #tokenArt(actor) {
    const t = actor.prototypeToken;
    return (t?.ring?.enabled && t.ring.subject?.texture) || t?.texture?.src || actor.img;
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
      this.element.querySelector('.sf-tile.is-focused .sf-tile__pick')?.focus({ preventScroll: true });
      // Stacked layout (matches the 720px container query): the panel is below the fold, so bring it up.
      if (this.element.querySelector('.sf-roster')?.clientWidth <= 720) {
        this.element.querySelector('.sf-dossier')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    this.#markNewClaims();
  }

  // A claim that wasn't there last render gets a short flourish on its tile and seat.
  // The first render only records state, so opening the roster doesn't animate everything.
  // A claim triggers several renders (scene, then user); each one resumes the animation
  // where it was via a negative delay instead of restarting or dropping it.
  #markNewClaims() {
    const FLOURISH_MS = 900;
    const claims = this._scene.flags?.sceneforge?.roster?.claims ?? {};
    const now = Object.fromEntries(Object.entries(claims).map(([id, c]) => [id, c?.claimedBy ?? null]));
    const before = this.#lastClaims;
    this.#lastClaims = now;
    if (before) {
      for (const [actorId, userId] of Object.entries(now)) {
        if (userId && before[actorId] !== userId) this.#flourishes.set(actorId, { userId, start: performance.now() });
      }
    }
    for (const [actorId, { userId, start }] of this.#flourishes) {
      const elapsed = performance.now() - start;
      if (elapsed > FLOURISH_MS || now[actorId] !== userId) { this.#flourishes.delete(actorId); continue; }
      const els = [
        this.element.querySelector(`.sf-tile[data-actor-id="${actorId}"]`),
        this.element.querySelector(`.sf-seat[data-user-id="${userId}"]`),
      ];
      for (const el of els) {
        el?.style.setProperty('--sf-flourish-delay', `-${Math.round(elapsed)}ms`);
        el?.classList.add('sf-just-claimed');
      }
    }
  }

  // One seat per player who is online or holds a claim here, in user-list order.
  #partySeats(claims, me) {
    const byUser = new Map(
      Object.entries(claims).filter(([, c]) => c?.claimedBy).map(([actorId, c]) => [c.claimedBy, actorId])
    );
    return game.users
      .filter(u => !u.isGM && (u.active || byUser.has(u.id)))
      .map(u => {
        const actor = game.actors.get(byUser.get(u.id));
        return {
          id:        u.id,
          name:      u.name,
          isMe:      u.id === me.id,
          away:      !u.active,
          color:     u.color?.css ?? String(u.color ?? ''),
          ringColor: actor?.prototypeToken?.ring?.colors?.ring ?? null,
          img:       actor ? RosterScene.#tokenArt(actor) : null,
          character: actor?.name ?? null,
        };
      });
  }

  static #onFocus(_e, target) {
    const actorId = RosterScene.#actorIdFrom(target);
    if (!actorId) return;

    // A native dblclick is unreliable here: the first click re-renders and replaces the
    // tile. Two clicks on the same character in quick succession open its sheet instead.
    const now = performance.now();
    const isDouble = this.#lastPick.actorId === actorId && now - this.#lastPick.at < 400;
    this.#lastPick = isDouble ? { actorId: null, at: 0 } : { actorId, at: now };
    if (isDouble) { game.actors.get(actorId)?.sheet.render(true); return; }

    if (actorId === this.#focusedId) return;
    this.#focusedId = actorId;
    this.#refocus = true;
    // Re-render through the renderer so scene bounds are re-applied afterwards.
    Hooks.callAll('sceneforge:dataChanged', this._scene.id);
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
    const userId  = target.dataset.userId;
    if (!actorId || !userId) return;
    // The chip may be stale if that player claimed something since the last render.
    const claims = this._scene.flags?.sceneforge?.roster?.claims ?? {};
    if (Object.values(claims).some(c => c?.claimedBy === userId)) return;
    await applyClaim(actorId, userId, this._scene.id);
  }

  static async #onBeginSession() {
    if (!game.user.isGM) return;
    const i18n = game.i18n;
    const esc = v => Handlebars.escapeExpression(v);

    // Play scenes only: the active one first, then the navigation bar's order, then the rest.
    const active = game.scenes.active;
    const rank = s => (s === active ? 0 : s.navigation ? 1 : 2);
    const scenes = game.scenes.contents
      .filter(s => s.id !== this._scene.id && !s.flags?.sceneforge?.type)
      .sort((a, b) => rank(a) - rank(b) || (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
    if (!scenes.length) { ui.notifications.warn('SCENEFORGE.Begin.NoScenes', { localize: true }); return; }

    const cards = scenes.map((s, i) => `
      <label class="sf-scene-card">
        <input type="radio" name="sceneId" value="${s.id}"${i === 0 ? ' checked' : ''}>
        <span class="sf-scene-card__thumb"${s.thumb ? ` style="background-image: url('${esc(s.thumb)}')"` : ''}></span>
        <span class="sf-scene-card__name">${esc(s.navName || s.name)}</span>
        ${s === active ? `<span class="sf-scene-card__active">${esc(i18n.localize('SCENEFORGE.Begin.Active'))}</span>` : ''}
      </label>`).join('');

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: i18n.localize('SCENEFORGE.Begin.Title'), icon: 'fas fa-flag-checkered' },
      position: { width: 560 },
      content: `<p class="sf-scene-pick__prompt">${esc(i18n.localize('SCENEFORGE.Begin.Prompt'))}</p>
        <div class="sf-scene-pick">${cards}</div>`,
      buttons: [
        { action: 'go', label: i18n.localize('SCENEFORGE.Begin.Go'), icon: 'fas fa-arrow-right', default: true,
          callback: (_e, _b, dialog) => ({ sceneId: dialog.element.querySelector('[name="sceneId"]:checked')?.value }) },
        { action: 'cancel', label: i18n.localize('SCENEFORGE.Cancel'), callback: () => null },
      ],
      rejectClose: false,
    });
    // A falsy callback result resolves to the action name, so only an object means "go".
    if (!result || typeof result !== 'object' || !result.sceneId) return;
    const sceneId = result.sceneId;
    const claims = this._scene.flags?.sceneforge?.roster?.claims ?? {};
    const cloneIds = (this._scene.flags?.sceneforge?.roster?.templates ?? [])
      .map(id => claims[id]?.cloneId)
      .filter(Boolean);
    if (cloneIds.length) setPending(cloneIds, sceneId);
    await game.scenes.get(sceneId)?.view();
  }

}
