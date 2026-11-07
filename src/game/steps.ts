import type { Recipe, RecipeStep } from '../config/recipes/recipe.js';

/** Where the player is in a recipe. Pure data, so it can be unit tested. */
export type GameState =
  | { phase: 'title' }
  | { phase: 'cooking'; stepIndex: number }
  | { phase: 'done' };

export const TITLE_STATE: GameState = { phase: 'title' };

export function startRecipe(recipe: Recipe): GameState {
  return recipe.steps.length > 0
    ? { phase: 'cooking', stepIndex: 0 }
    : { phase: 'done' };
}

/** Moves on, skipping steps for optional ingredients the player left out. */
export function completeStep(
  state: GameState,
  recipe: Recipe,
  placedIds?: ReadonlySet<string>,
): GameState {
  if (state.phase !== 'cooking') {
    return state;
  }
  for (
    let nextIndex = state.stepIndex + 1;
    nextIndex < recipe.steps.length;
    nextIndex += 1
  ) {
    const needed = recipe.steps[nextIndex]?.onlyIfPlaced;
    if (needed == null || placedIds == null || placedIds.has(needed)) {
      return { phase: 'cooking', stepIndex: nextIndex };
    }
  }
  return { phase: 'done' };
}

export function currentStep(
  state: GameState,
  recipe: Recipe,
): RecipeStep | null {
  return state.phase === 'cooking'
    ? (recipe.steps[state.stepIndex] ?? null)
    : null;
}

export function requiredIngredientCount(recipe: Recipe): number {
  return recipe.ingredients.filter((ingredient) => !ingredient.optional).length;
}

/** Optional ingredients never hold the player back. */
export function isPreparationReady(
  recipe: Recipe,
  placedIds: ReadonlySet<string>,
): boolean {
  return recipe.ingredients.every(
    (ingredient) => ingredient.optional || placedIds.has(ingredient.id),
  );
}

/** Every ingredient, optional ones included, is on its outline. */
export function isPreparationComplete(
  recipe: Recipe,
  placedIds: ReadonlySet<string>,
): boolean {
  return recipe.ingredients.every((ingredient) =>
    placedIds.has(ingredient.id),
  );
}
