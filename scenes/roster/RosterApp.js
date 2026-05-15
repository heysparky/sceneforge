import RosterGM from './RosterGM.js';
import { emit, gmRelease } from '../../core/socket.js';

export default class RosterApp {
  #scene = null;
  #container = null;
  #updateHandler = null;
  #settingsHandler = null;

  async render(scene, container) {
    this.#scene = scene;
    this.#container = container;

    this.#updateHandler = (updated) => {
      console.log('SF | updateScene fired, id match:', updated.id === scene.id, updated.id, scene.id);
      if (updated.id === scene.id) this.#renderContent().catch(console.error);
    };
    Hooks.on('updateScene', this.#updateHandler);

    this.#settingsHandler = () => this.#renderContent();
    Hooks.on('sceneforge:settingsChanged', this.#settingsHandler);

    await this.#renderContent();
  }

  async #renderContent() {
    const roster = this.#scene.flags?.sceneforge?.roster ?? {};
    console.log('SF | #renderContent: claims=', JSON.stringify(roster.claims));
    const claims = roster.claims ?? {};

    const enrollmentOpen = game.settings.get('sceneforge', 'rosterEnrollmentOpen');
    const showClaimedBy  = game.settings.get('sceneforge', 'rosterShowClaimedBy');

    const cards = (roster.pool ?? [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(entry => {
        const actor = game.actors.get(entry.actorId);
        if (!actor) return null;
        const claim          = claims[entry.actorId] ?? null;
        const claimedBy      = claim?.userId ?? null;
        const claimerName    = claimedBy ? (game.users.get(claimedBy)?.name ?? '') : '';
        const isOwnClaim     = claimedBy === game.user.id;
        const isOtherClaim   = !!claimedBy && !isOwnClaim;
        const showReleaseBtn = game.user.isGM ? !!claimedBy : isOwnClaim;
        const showClaimBtn   = !game.user.isGM && !claimedBy && enrollmentOpen;
        return { actor, entry, claimedBy, claimerName, isOwnClaim, isOtherClaim,
                 showReleaseBtn, showClaimBtn };
      })
      .filter(Boolean);

    const playerHasClaim = cards.some(c => c.isOwnClaim);

    this.#container.innerHTML = await foundry.applications.handlebars.renderTemplate(
      'modules/sceneforge/scenes/roster/roster.html',
      { cards, enrollmentOpen, showClaimedBy, isGM: game.user.isGM, playerHasClaim }
    );
    this.#activateListeners();
  }

  #activateListeners() {
    const el      = this.#container;
    const sceneId = this.#scene.id;

    el.querySelector('[data-action="toggle-enrollment"]')
      ?.addEventListener('click', () => this.#toggleEnrollment());
    el.querySelector('[data-action="edit-roster"]')
      ?.addEventListener('click', () => new RosterGM(this.#scene).render(true));

    el.querySelectorAll('.sf-claim-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.sf-claim-btn').forEach(b => b.disabled = true);
        emit({ action: 'roster.claim', sceneId, senderId: game.user.id,
               payload: { actorId: btn.dataset.actorId } });
      });
    });

    el.querySelectorAll('.sf-release-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const actorId = btn.dataset.actorId;
        if (game.user.isGM) {
          gmRelease(sceneId, actorId).catch(console.error);
        } else {
          emit({ action: 'roster.release', sceneId, senderId: game.user.id,
                 payload: { actorId } });
        }
      });
    });
  }

  teardown() {
    if (this.#updateHandler) {
      Hooks.off('updateScene', this.#updateHandler);
      this.#updateHandler = null;
    }
    if (this.#settingsHandler) {
      Hooks.off('sceneforge:settingsChanged', this.#settingsHandler);
      this.#settingsHandler = null;
    }
  }

  gmControls() {
    return [];
  }

  async #toggleEnrollment() {
    const current = game.settings.get('sceneforge', 'rosterEnrollmentOpen');
    await game.settings.set('sceneforge', 'rosterEnrollmentOpen', !current);
  }
}
