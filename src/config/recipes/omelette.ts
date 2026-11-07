import type { Recipe, RecipeIngredient } from './recipe.js';

const egg: RecipeIngredient = {
  id: 'egg',
  label: 'Egg',
  silhouette: 'egg',
  lengthM: 0.06,
  widthM: 0.045,
  sheetPosition: [-0.1, -0.085],
  restHeightM: 0.0225,
};

const salt: RecipeIngredient = {
  id: 'salt',
  label: 'Salt',
  silhouette: 'shaker',
  lengthM: 0.1,
  widthM: 0.05,
  sheetPosition: [0.1, -0.085],
  restHeightM: 0.025,
  snapRollDeg: -90,
};

const butter: RecipeIngredient = {
  id: 'butter',
  label: 'Butter',
  silhouette: 'block',
  lengthM: 0.09,
  widthM: 0.04,
  sheetPosition: [-0.1, 0.085],
  restHeightM: 0.015,
};

const greenOnion: RecipeIngredient = {
  id: 'green-onion',
  label: 'Green onion',
  silhouette: 'stalks',
  lengthM: 0.16,
  widthM: 0.035,
  sheetPosition: [0.1, 0.085],
  restHeightM: 0.007,
  optional: true,
};

const ALL_INGREDIENTS = ['egg', 'salt', 'butter', 'green-onion'];
const AFTER_CRACK = ['salt', 'butter', 'green-onion'];

/**
 * Outline centers sit at least 17 cm apart, so two 8 cm snap zones never
 * overlap and a held ingredient always has one unambiguous target.
 */
export const OMELETTE: Recipe = {
  id: 'omelette',
  title: 'Omelette',
  intro: 'Point at Start and pinch to begin.',
  outro: 'Nicely done! Press Again to cook once more.',
  sheetSizeM: [0.4, 0.32],
  ingredients: [egg, salt, butter, greenOnion],
  steps: [
    {
      id: 'prepare',
      title: 'Ingredients',
      instruction: 'Place each ingredient on its outline.',
      tip: 'Having everything within reach keeps you calm once the pan is hot.',
      completion: 'place-ingredients',
      tools: [],
      grabbableTools: [],
      ingredients: ALL_INGREDIENTS,
      grabbableIngredients: ALL_INGREDIENTS,
    },
    {
      id: 'crack',
      title: 'Crack the egg',
      instruction: 'Hold the egg over the bowl with both hands and pull apart.',
      tip: 'A firm, clean crack keeps bits of shell out of the bowl.',
      completion: 'crack',
      tools: ['bowl', 'stove'],
      grabbableTools: [],
      ingredients: ALL_INGREDIENTS,
      grabbableIngredients: ['egg'],
    },
    {
      id: 'whisk',
      title: 'Whisk',
      instruction: 'Pinch the whisk and stir circles in the bowl.',
      tip: 'Whisking adds air, which makes the omelette light and fluffy.',
      completion: 'whisk',
      tools: ['bowl', 'whisk', 'stove'],
      grabbableTools: ['whisk'],
      ingredients: AFTER_CRACK,
      grabbableIngredients: [],
    },
    {
      id: 'season',
      title: 'Season',
      instruction: 'Hold the salt over the bowl and tip it twice.',
      tip: 'Salting the eggs early seasons them evenly all the way through.',
      completion: 'season',
      tools: ['bowl', 'stove'],
      grabbableTools: [],
      ingredients: AFTER_CRACK,
      grabbableIngredients: ['salt'],
    },
    {
      id: 'heat',
      title: 'Heat the pan',
      instruction: 'Set the pan on the stove, then drop the butter in.',
      tip: 'Melted butter adds flavor and keeps the egg from sticking.',
      completion: 'heat',
      tools: ['bowl', 'pan', 'stove'],
      grabbableTools: ['pan'],
      ingredients: ['butter'],
      grabbableIngredients: ['butter'],
    },
    {
      id: 'pour',
      title: 'Pour',
      instruction: 'Tip the bowl over the pan until it is empty.',
      tip: 'A pan that is already hot sets the eggs before they can stick.',
      completion: 'pour',
      tools: ['bowl', 'pan', 'stove'],
      grabbableTools: ['bowl'],
      ingredients: [],
      grabbableIngredients: [],
    },
    {
      id: 'cook',
      title: 'Cook',
      instruction: 'When it turns golden, lift the pan off the stove.',
      tip: 'Eggs keep cooking in the hot pan, so take them off a little early.',
      completion: 'cook',
      tools: ['pan', 'stove'],
      grabbableTools: ['pan'],
      ingredients: [],
      grabbableIngredients: [],
    },
    {
      id: 'flip',
      title: 'Flip and plate',
      instruction: 'Flick the pan, then move the omelette to the plate.',
      tip: 'A quick flick of the wrist folds the omelette in one clean move.',
      completion: 'flip',
      tools: ['pan', 'stove', 'plate'],
      grabbableTools: ['pan'],
      ingredients: [],
      grabbableIngredients: [],
    },
  ],
};

export const OMELETTE_INGREDIENTS = { egg, salt, butter, greenOnion } as const;
