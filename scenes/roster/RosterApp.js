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
  }

  teardown() {
    if (this.#updateHandler) {
      Hooks.off('updateScene', this.#updateHandler);
      this.#updateHandler = null;
    }
  }

  gmControls() {
    const roster = this.#scene.flags?.sceneforge?.roster ?? {};
    const open = roster.config?.enrollmentOpen ?? true;
    return [
      {
        icon: open ? 'fas fa-door-open' : 'fas fa-door-closed',
        label: open ? 'Enrollment: Open' : 'Enrollment: Closed',
        onClick: () => this.#toggleEnrollment(),
      },
      {
        icon: 'fas fa-cog',
        label: 'Edit Roster',
        onClick: () => new RosterGM(this.#scene).render(true),
      },
    ];
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
