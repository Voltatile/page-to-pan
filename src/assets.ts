import { AssetType, defineAssets } from '@iwsdk/core';
import {
  OMELETTE,
  OMELETTE_INGREDIENTS,
} from './config/recipes/omelette.js';
import {
  createBowl,
  createPan,
  createPlate,
  createStove,
  createWhisk,
} from './scene-assets/cookware.scene-asset.js';
import {
  createButter,
  createEgg,
  createGreenOnion,
  createSaltShaker,
} from './scene-assets/ingredients.scene-asset.js';
import {
  createKitchenRoom,
  createKitchenTable,
  createRecipeStand,
} from './scene-assets/kitchen.scene-asset.js';
import { createRecipeSheet } from './scene-assets/recipe-sheet.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'kitchen-room': createKitchenRoom(),
  'kitchen-table': createKitchenTable(),
  'recipe-stand': createRecipeStand(),
  'recipe-sheet-omelette': createRecipeSheet(OMELETTE),
  'ingredient-egg': createEgg(OMELETTE_INGREDIENTS.egg),
  'ingredient-salt': createSaltShaker(OMELETTE_INGREDIENTS.salt),
  'ingredient-butter': createButter(OMELETTE_INGREDIENTS.butter),
  'ingredient-green-onion': createGreenOnion(OMELETTE_INGREDIENTS.greenOnion),
  'tool-bowl': createBowl(),
  'tool-whisk': createWhisk(),
  'tool-pan': createPan(),
  'tool-stove': createStove(),
  'tool-plate': createPlate(),
  'recipe-card': uikitml('recipe-card.uikitml', 'Recipe Card'),
  'recipe-labels': uikitml('recipe-labels.uikitml', 'Recipe Labels'),
  'title-logo': uikitml('title-logo.uikitml', 'Title Logo'),
  'result-banner': uikitml('result-banner.uikitml', 'Result Banner'),
});
