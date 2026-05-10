import { registerSceneType } from '../../core/registry.js';

registerSceneType('roster', () => import('./RosterApp.js'));
