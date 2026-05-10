export default class MerchantApp {
  render(_scene, container) {
    container.innerHTML = `
      <div class="sceneforge-placeholder">
        <i class="fas fa-store fa-3x"></i>
        <h2>Merchant</h2>
        <p>Coming in a future version</p>
      </div>
    `;
  }

  teardown() {}

  gmControls() { return []; }
}
