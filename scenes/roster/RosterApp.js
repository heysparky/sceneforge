import RosterGM from './RosterGM.js';
import { emit } from '../../core/socket.js';

export default class RosterApp {
  #scene = null;
  #container = null;
  #updateHandler = null;
  #settingsHandler = null;

  async render(scene, container) {
    this.#scene = scene;
    this.#container = container;

    this.#updateHandler = (updated, changes) => {
      if (updated.id === scene.id && foundry.utils.hasProperty(changes, 'flags.sceneforge.roster')) {
        this.#renderContent();
      }
    };
    Hooks.on('updateScene', this.#updateHandler);

    this.#settingsHandler = () => this.#renderContent();
    Hooks.on('sceneforge:settingsChanged', this.#settingsHandler);

    await this.#renderContent();
  }

  async #renderContent() {
    const roster = this.#scene.flags?.sceneforge?.roster ?? {};
    const claims = roster.claims ?? {};

    const enrollmentOpen = game.settings.get('sceneforge', 'rosterEnrollmentOpen');
    const showClaimedBy  = game.settings.get('sceneforge', 'rosterShowClaimedBy');

    const cards = (roster.pool ?? [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(entry => {
        const actor = game.actors.get(entry.actorId);
        if (!actor) return null;
        const claim       = claims[entry.actorId] ?? null;
        const claimedBy   = claim?.userId ?? null;
        const claimerName = claimedBy ? (game.users.get(claimedBy)?.name ?? '') : '';
        const isOwnClaim  = claimedBy === game.user.id;
        const isOtherClaim = !!claimedBy && !isOwnClaim;
        return { actor, entry, claimedBy, claimerName, isOwnClaim, isOtherClaim };
      })
      .filter(Boolean);

    this.#container.innerHTML = await foundry.applications.handlebars.renderTemplate(
      'modules/sceneforge/scenes/roster/roster.html',
      { cards, enrollmentOpen, showClaimedBy, isGM: game.user.isGM }
    );
    this.#activateListeners(enrollmentOpen);
  }

  #activateListeners(enrollmentOpen) {
    const el      = this.#container;
    const sceneId = this.#scene.id;

    el.querySelector('[data-action="toggle-enrollment"]')
      ?.addEventListener('click', () => this.#toggleEnrollment());
    el.querySelector('[data-action="edit-roster"]')
      ?.addEventListener('click', () => new RosterGM(this.#scene).render(true));

    if (!game.user.isGM && enrollmentOpen) {
      el.querySelectorAll('.sf-roster-card:not(.claimed):not(.own-claim)').forEach(card => {
        card.addEventListener('click', () => {
          emit({ action: 'roster.claim', sceneId, senderId: game.user.id,
                 payload: { actorId: card.dataset.actorId } });
        });
      });
    }

    el.querySelectorAll('.sf-release-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        emit({ action: 'roster.release', sceneId, senderId: game.user.id,
               payload: { actorId: btn.dataset.actorId } });
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
