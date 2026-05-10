export default class RosterApp {
  render(_scene, container) {
    container.innerHTML = `
      <div class="sceneforge-placeholder">
        <i class="fas fa-users fa-3x"></i>
        <h2>Character Roster</h2>
        <p>Milestone 1 — coming soon</p>
      </div>
    `;
  }

  teardown() {}

  gmControls() { return []; }
}
