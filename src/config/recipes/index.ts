import { OMELETTE } from './omelette.js';
import type { Recipe } from './recipe.js';

/** Every recipe in the game, in the order the player browses them. */
export const RECIPES: readonly Recipe[] = [OMELETTE];

/** The scene node that holds a recipe's printed sheet. */
export const sheetNodeId = (recipe: Recipe) => `recipe-sheet-${recipe.id}`;

/**
 * The recipe to open with: `?recipe=<id>` picks one directly, which also
 * reaches recipes still being built. Otherwise the first in the list.
 */
export function initialRecipe(
  search: string = globalThis.location?.search ?? '',
  extra: readonly Recipe[] = [],
): Recipe {
  const wanted = new URLSearchParams(search).get('recipe');
  const found = [...RECIPES, ...extra].find((recipe) => recipe.id === wanted);
  return found ?? (RECIPES[0] as Recipe);
}
