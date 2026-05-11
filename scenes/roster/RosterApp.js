import RosterGM from './RosterGM.js';

export default class RosterApp {
  #scene = null;
  #container = null;
  #updateHandler = null;
  #settingsHandler = null;

  async render(scene, container) {
    this.#scene = scene;
    this.#container = container;

    this.#updateHandler = (updated, changes) => {
      if (updated.id === scene.id && changes.flags?.sceneforge) {
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
    const showClaimedBy = game.settings.get('sceneforge', 'rosterShowClaimedBy');

    const cards = (roster.pool ?? [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(entry => {
        const actor = game.actors.get(entry.actorId);
        if (!actor) return null;
        const claimedBy = claims[entry.actorId] ?? null;
        const claimerName = claimedBy ? (game.users.get(claimedBy)?.name ?? '') : '';
        return { actor, entry, claimedBy, claimerName };
      })
      .filter(Boolean);

    this.#container.innerHTML = await foundry.applications.handlebars.renderTemplate(
      'modules/sceneforge/scenes/roster/roster.html',
      { cards, enrollmentOpen, showClaimedBy, isGM: game.user.isGM }
    );
    this.#activateListeners();
  }

  #activateListeners() {
    const el = this.#container;
    el.querySelector('[data-action="toggle-enrollment"]')
      ?.addEventListener('click', () => this.#toggleEnrollment());
    el.querySelector('[data-action="edit-roster"]')
      ?.addEventListener('click', () => new RosterGM(this.#scene).render(true));
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
