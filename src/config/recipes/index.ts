import { NASI_GORENG } from './nasi-goreng.js';
import { OMELETTE } from './omelette.js';
import type { Recipe } from './recipe.js';

/** Every recipe the player can browse, in order. */
export const RECIPES: readonly Recipe[] = [OMELETTE];

/** Recipes still being built: in the scene, but only opened by address. */
const IN_PROGRESS: readonly Recipe[] = [NASI_GORENG];

/** Every recipe in the scene, finished or not. */
export const ALL_RECIPES: readonly Recipe[] = [...RECIPES, ...IN_PROGRESS];

/** The scene node that holds a recipe's printed sheet. */
export const sheetNodeId = (recipe: Recipe) => `recipe-sheet-${recipe.id}`;

/**
 * The recipe to open with: `?recipe=<id>` picks one directly, which also
 * reaches recipes still being built. Otherwise the first in the list.
 */
export function initialRecipe(
  search: string = globalThis.location?.search ?? '',
): Recipe {
  const wanted = new URLSearchParams(search).get('recipe');
  const found = ALL_RECIPES.find((recipe) => recipe.id === wanted);
  return found ?? (RECIPES[0] as Recipe);
}
