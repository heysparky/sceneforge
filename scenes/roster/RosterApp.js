import RosterGM from './RosterGM.js';

export default class RosterApp {
  #scene = null;
  #container = null;
  #updateHandler = null;

  async render(scene, container) {
    this.#scene = scene;
    this.#container = container;

    this.#updateHandler = (updated, changes) => {
      if (updated.id === scene.id && changes.flags?.sceneforge) {
        this.#renderContent();
      }
    };
    Hooks.on('updateScene', this.#updateHandler);

    await this.#renderContent();
  }

  async #renderContent() {
    const roster = this.#scene.flags?.sceneforge?.roster ?? {};
    const config = roster.config ?? { enrollmentOpen: true, otherPlayerPermission: 1, showClaimedBy: true };
    const claims = roster.claims ?? {};

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

    this.#container.innerHTML = await renderTemplate(
      'modules/sceneforge/scenes/roster/roster.html',
      { cards, config, isGM: game.user.isGM }
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
  }

  gmControls() {
    return [];
  }

  async #toggleEnrollment() {
    const roster = this.#scene.flags?.sceneforge?.roster ?? {};
    const config = roster.config ?? { enrollmentOpen: true, otherPlayerPermission: 1, showClaimedBy: true };
    await this.#scene.setFlag('sceneforge', 'roster', {
      ...roster,
      config: { ...config, enrollmentOpen: !config.enrollmentOpen },
    });
  }
}
