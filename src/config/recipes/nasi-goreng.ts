import { OMELETTE_INGREDIENTS } from './omelette.js';
import type { Recipe, RecipeIngredient } from './recipe.js';

const { egg, greenOnion } = OMELETTE_INGREDIENTS;

/** Lies on its side on the sheet, like the salt shaker. */
const soySauce: RecipeIngredient = {
  id: 'soy-sauce',
  label: 'Sweet soy',
  silhouette: 'shaker',
  lengthM: 0.15,
  widthM: 0.05,
  sheetPosition: [0.1, -0.085],
  restHeightM: 0.025,
  snapRollDeg: -90,
};

/** A small bowl of cooked rice, seen from above as a circle. */
const rice: RecipeIngredient = {
  id: 'rice',
  label: 'Rice',
  silhouette: 'bowl',
  lengthM: 0.1,
  widthM: 0.1,
  sheetPosition: [-0.1, 0.085],
  restHeightM: 0.0225,
};

const ALL_INGREDIENTS = ['egg', 'soy-sauce', 'rice', 'green-onion'];
const AFTER_EGG = ['soy-sauce', 'rice', 'green-onion'];
const AFTER_RICE = ['soy-sauce', 'green-onion'];

/**
 * Indonesian fried rice for beginners. It reuses the omelette's hand moves
 * (crack, stir, tip, drop, lift, serve), all done over the pan this time.
 */
export const NASI_GORENG: Recipe = {
  id: 'nasi-goreng',
  title: 'Nasi Goreng',
  dish: 'fried-rice',
  // The rice only toasts once it is all in the pan, so a slow hand with the
  // bottle never burns it.
  heatSteps: ['stir-fry', 'garnish', 'finish', 'plate'],
  // Stirring and the green onion both happen on the heat, so the rice gets
  // more time than the omelette before it browns.
  cookDurationS: 40,
  chefNotes: {
    praise: 'Perfect! Toasty, sweet, and seasoned just right.',
    moreSalt: 'Add a little more sweet soy: two dashes is just right.',
    lessSalt: 'Go easy on the sweet soy: two dashes is plenty.',
    crack: 'Crack the egg right over the middle of the pan.',
    whisk: 'Stir a few more turns to mix it all.',
  },
  intro: 'Point at Start and pinch to begin.',
  outro: 'Delicious! Press Again to cook once more.',
  sheetSizeM: [0.4, 0.32],
  ingredients: [egg, soySauce, rice, greenOnion],
  steps: [
    {
      id: 'prepare',
      title: 'Ingredients',
      instruction: 'Place each ingredient on its outline.',
      tip: 'Fried rice cooks fast, so have everything ready first.',
      hint: 'Pinch an ingredient, carry it to its dark outline, and let go.',
      completion: 'place-ingredients',
      tools: [],
      grabbableTools: [],
      ingredients: ALL_INGREDIENTS,
      grabbableIngredients: ALL_INGREDIENTS,
    },
    {
      id: 'heat',
      title: 'Heat the pan',
      instruction: 'Set the pan on the stove to heat it.',
      tip: 'A hot pan fries the rice instead of steaming it.',
      hint: 'Pinch the pan handle, carry it over the stove, and let go.',
      completion: 'seat-pan',
      guides: [{ held: 'pan', target: 'stove' }],
      tools: ['pan', 'stove'],
      grabbableTools: ['pan'],
      ingredients: ALL_INGREDIENTS,
      grabbableIngredients: [],
    },
    {
      id: 'crack',
      title: 'Crack the egg',
      instruction: 'Hold the egg over the pan with both hands and pull apart.',
      tip: 'Cooking the egg first gives soft golden bits in the rice.',
      hint: 'Pinch the egg, pinch beside it with your other hand, then pull.',
      completion: 'crack',
      zone: 'pan',
      guides: [{ held: 'egg', target: 'pan' }],
      tools: ['pan', 'stove'],
      grabbableTools: [],
      ingredients: ALL_INGREDIENTS,
      grabbableIngredients: ['egg'],
    },
    {
      id: 'scramble',
      title: 'Scramble',
      instruction: 'Pinch the spatula and stir circles in the pan.',
      tip: 'Break the egg into small pieces while it sets.',
      hint: 'Pinch the spatula, dip it in the pan, and stir in wide circles.',
      completion: 'stir',
      zone: 'pan',
      tool: 'spatula',
      turns: 2,
      guides: [{ held: 'spatula', target: 'pan' }],
      tools: ['pan', 'stove', 'spatula'],
      grabbableTools: ['spatula'],
      ingredients: AFTER_EGG,
      grabbableIngredients: [],
    },
    {
      id: 'rice',
      title: 'Add the rice',
      instruction: 'Hold the rice bowl over the pan and let go.',
      tip: 'Day-old rice is drier, so it fries without turning mushy.',
      hint: 'Carry the rice bowl over the pan and open your fingers.',
      completion: 'drop',
      zone: 'pan',
      item: 'rice',
      guides: [{ held: 'rice', target: 'pan' }],
      tools: ['pan', 'stove', 'spatula'],
      grabbableTools: [],
      ingredients: AFTER_EGG,
      grabbableIngredients: ['rice'],
    },
    {
      id: 'season',
      title: 'Season',
      instruction: 'Hold the sweet soy over the pan and tip it twice.',
      tip: 'Sweet soy sauce gives fried rice its color and gentle sweetness.',
      hint: 'Turn the bottle upside down over the pan, then upright again.',
      completion: 'season',
      zone: 'pan',
      item: 'soy-sauce',
      guides: [{ held: 'soy-sauce', target: 'pan' }],
      tools: ['pan', 'stove', 'spatula'],
      grabbableTools: [],
      ingredients: AFTER_RICE,
      grabbableIngredients: ['soy-sauce'],
    },
    {
      id: 'stir-fry',
      title: 'Stir-fry',
      instruction: 'Stir the rice with the spatula to mix it all.',
      tip: 'Keep it moving so every grain gets coated and toasted.',
      hint: 'Pinch the spatula and stir wide circles until the count is done.',
      completion: 'stir',
      zone: 'pan',
      tool: 'spatula',
      turns: 3,
      guides: [{ held: 'spatula', target: 'pan' }],
      tools: ['pan', 'stove', 'spatula'],
      grabbableTools: ['spatula'],
      ingredients: AFTER_RICE,
      grabbableIngredients: [],
    },
    {
      id: 'garnish',
      title: 'Green onion',
      instruction: 'Hold the green onion over the pan and let go.',
      tip: 'Added late, green onion stays bright and fresh.',
      hint: 'Carry the green onion over the pan and open your fingers.',
      completion: 'drop',
      zone: 'pan',
      item: 'green-onion',
      onlyIfPlaced: 'green-onion',
      guides: [{ held: 'green-onion', target: 'pan' }],
      tools: ['pan', 'stove'],
      grabbableTools: [],
      ingredients: AFTER_RICE,
      grabbableIngredients: ['green-onion'],
    },
    {
      id: 'finish',
      title: 'Finish',
      instruction: 'When it turns golden, lift the pan off the stove.',
      tip: 'Lift it in time: the bottom browns fast at the end.',
      hint: 'Wait for Golden on the card, then pinch the handle and lift.',
      completion: 'finish',
      tools: ['pan', 'stove', 'plate'],
      grabbableTools: ['pan'],
      ingredients: ['soy-sauce'],
      grabbableIngredients: [],
    },
    {
      id: 'plate',
      title: 'Serve',
      instruction: 'Bring the pan over the plate.',
      tip: 'Serve it hot, while the rice is still crisp.',
      hint: 'Carry the pan over the plate. The rice slides off on its own.',
      completion: 'plate',
      guides: [{ held: 'pan', target: 'plate' }],
      tools: ['pan', 'stove', 'plate'],
      grabbableTools: ['pan'],
      ingredients: ['soy-sauce'],
      grabbableIngredients: [],
    },
  ],
};

export const NASI_GORENG_INGREDIENTS = { soySauce, rice } as const;
