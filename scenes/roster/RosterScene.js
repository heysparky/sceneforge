import { SceneForgeScene } from '../SceneForgeScene.js';

export default class RosterScene extends SceneForgeScene {
  static TYPE = 'roster';

  static DEFAULT_OPTIONS = {
    id: 'sceneforge-roster',
  };

  static PARTS = {
    main: { template: 'modules/sceneforge/scenes/roster/roster.html' },
  };
}
