import type { Recipe, RecipeIngredient } from './recipe.js';

const egg: RecipeIngredient = {
  id: 'egg',
  label: 'Egg',
  silhouette: 'egg',
  lengthM: 0.06,
  widthM: 0.045,
  sheetPosition: [-0.1, -0.085],
};

const salt: RecipeIngredient = {
  id: 'salt',
  label: 'Salt',
  silhouette: 'shaker',
  lengthM: 0.1,
  widthM: 0.05,
  sheetPosition: [0.1, -0.085],
};

const butter: RecipeIngredient = {
  id: 'butter',
  label: 'Butter',
  silhouette: 'block',
  lengthM: 0.09,
  widthM: 0.04,
  sheetPosition: [-0.1, 0.085],
};

const greenOnion: RecipeIngredient = {
  id: 'green-onion',
  label: 'Green onion',
  silhouette: 'stalks',
  lengthM: 0.16,
  widthM: 0.035,
  sheetPosition: [0.1, 0.085],
  optional: true,
};

/**
 * Outline centers sit at least 17 cm apart, so two 8 cm snap zones never
 * overlap and a held ingredient always has one unambiguous target.
 */
export const OMELETTE: Recipe = {
  id: 'omelette',
  title: 'Omelette',
  instruction: 'Place each ingredient on its outline.',
  sheetSizeM: [0.4, 0.32],
  ingredients: [egg, salt, butter, greenOnion],
};

export const OMELETTE_INGREDIENTS = { egg, salt, butter, greenOnion } as const;
