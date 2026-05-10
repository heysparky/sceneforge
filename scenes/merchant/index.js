import { registerSceneType } from '../../core/registry.js';

registerSceneType('merchant', () => import('./MerchantApp.js'));
