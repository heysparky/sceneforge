const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;


export class SceneForgeScene extends HandlebarsApplicationMixin(ApplicationV2) {
  static TYPE = null; // override in subclass

  static DEFAULT_OPTIONS = {
    window: { frame: false },
    classes: ['sceneforge-scene-app'],
  };

  constructor(scene, options = {}) {
    super(options);
    this._scene = scene;
  }

  get scene() { return this._scene; }

  async _prepareContext(_options) {
    return {
      scene: this._scene,
      isGM: game.user.isGM,
    };
  }

  async addItems() {}
}
