import { OMELETTE_INGREDIENTS } from './omelette.js';
import type { Recipe, RecipeIngredient } from './recipe.js';

const { egg } = OMELETTE_INGREDIENTS;

/** Amber maple syrup bottle, resting on its side on the sheet top-right. */
const syrup: RecipeIngredient = {
  id: 'syrup',
  label: 'Maple syrup',
  silhouette: 'shaker',
  lengthM: 0.14,
  widthM: 0.05,
  sheetPosition: [0.1, -0.085],
  restHeightM: 0.025,
  snapRollDeg: -90,
};

/** Small ceramic bowl heaped with white flour, bottom-left on the sheet. */
const flour: RecipeIngredient = {
  id: 'flour',
  label: 'Flour',
  silhouette: 'bowl',
  lengthM: 0.1,
  widthM: 0.1,
  sheetPosition: [-0.1, 0.085],
  restHeightM: 0.0225,
};

/** Butter block placed on the bottom-right slot of the pancake sheet. */
const butter: RecipeIngredient = {
  ...OMELETTE_INGREDIENTS.butter,
  sheetPosition: [0.1, 0.085],
};

export const PANCAKE_INGREDIENTS = {
  egg,
  syrup,
  flour,
  butter,
} as const;

const ALL_INGREDIENTS = ['egg', 'syrup', 'flour', 'butter'];
const AFTER_FLOUR = ['egg', 'syrup', 'butter'];
const AFTER_CRACK = ['syrup', 'butter'];
const AFTER_BUTTER = ['syrup'];

/**
 * Third recipe in the cookbook: a fluffy golden pancake made with flour,
 * egg, melted butter, spatula batter-spreading, mid-air flip, and warm
 * maple syrup drizzled right in the pan.
 */
export const PANCAKE: Recipe = {
  id: 'pancake',
  title: 'Pancake',
  dish: 'pancake',
  heatSteps: ['cook', 'finish', 'plate'],
  cookDurationS: 28,
  chefNotes: {
    praise: 'Golden, fluffy, and glazed with warm maple syrup!',
    moreSalt: 'Drizzle two dashes of maple syrup for the best glaze.',
    lessSalt: 'Easy on the maple syrup: two dashes is plenty sweet.',
    crack: 'Crack the egg right over the flour in the bowl.',
    whisk: 'Whisk all four turns so the flour and egg blend smooth.',
  },
  intro: 'Flour batter, spatula spread, maple glaze.',
  outro: 'Fluffy and golden! Press Again to cook another pancake.',
  sheetSizeM: [0.4, 0.32],
  ingredients: [egg, syrup, flour, butter],
  steps: [
    {
      id: 'prepare',
      title: 'Ingredients',
      instruction: 'Place each ingredient on its outline.',
      tip: 'Measure flour, egg, butter, and syrup before heating the pan.',
      hint: 'Pinch an ingredient, carry it to its dark outline, and let go.',
      completion: 'place-ingredients',
      tools: [],
      grabbableTools: [],
      ingredients: ALL_INGREDIENTS,
      grabbableIngredients: ALL_INGREDIENTS,
    },
    {
      id: 'flour',
      title: 'Add the flour',
      instruction: 'Hold the flour bowl over the mixing bowl and let go.',
      tip: 'Soft wheat flour gives the pancake its thick, pillowy body.',
      hint: 'Carry the flour bowl over the large bowl and open your hand.',
      completion: 'drop',
      zone: 'bowl',
      item: 'flour',
      guides: [{ held: 'flour', target: 'bowl' }],
      tools: ['bowl', 'stove'],
      grabbableTools: [],
      ingredients: ALL_INGREDIENTS,
      grabbableIngredients: ['flour'],
    },
    {
      id: 'crack',
      title: 'Crack the egg',
      instruction: 'Hold the egg over the flour bowl with both hands and pull.',
      tip: 'Cracking the egg onto the flour binds the batter richly.',
      hint: 'Pinch the egg, pinch beside it with your other hand, then pull.',
      completion: 'crack',
      zone: 'bowl',
      guides: [{ held: 'egg', target: 'bowl' }],
      tools: ['bowl', 'stove'],
      grabbableTools: [],
      ingredients: AFTER_FLOUR,
      grabbableIngredients: ['egg'],
    },
    {
      id: 'whisk',
      title: 'Mix batter',
      instruction: 'Pinch the whisk and stir 4 circles to blend the flour.',
      tip: 'Folding air into the flour and egg makes the batter rise high.',
      hint: 'Hold the whisk tip inside the bowl and stir four wide circles.',
      completion: 'whisk',
      zone: 'bowl',
      turns: 4,
      guides: [{ held: 'whisk', target: 'bowl' }],
      tools: ['bowl', 'whisk', 'stove'],
      grabbableTools: ['whisk'],
      ingredients: AFTER_CRACK,
      grabbableIngredients: [],
    },
    {
      id: 'heat',
      title: 'Butter the pan',
      instruction: 'Set the pan on the stove, then drop the butter into it.',
      tip: 'Foaming butter crisps the pancake rim as the batter lands.',
      hint: 'Let go of the pan over the stove, then drop the butter into it.',
      completion: 'heat',
      guides: [
        { held: 'pan', target: 'stove' },
        { held: 'butter', target: 'pan' },
      ],
      tools: ['bowl', 'pan', 'stove'],
      grabbableTools: ['pan'],
      ingredients: AFTER_CRACK,
      grabbableIngredients: ['butter'],
    },
    {
      id: 'pour',
      title: 'Pour batter',
      instruction: 'Tilt the bowl over the pan to pour the thick batter in.',
      tip: 'Pouring into the center forms a thick mound ready to spread.',
      hint: 'Hold the bowl over the pan and tilt until the stream finishes.',
      completion: 'pour',
      guides: [{ held: 'bowl', target: 'pan' }],
      tools: ['bowl', 'pan', 'stove'],
      grabbableTools: ['bowl'],
      ingredients: AFTER_BUTTER,
      grabbableIngredients: [],
    },
    {
      id: 'spread',
      title: 'Spread batter',
      instruction: 'Pinch the spatula and swirl 2 circles to spread the batter.',
      tip: 'Gently leveling the batter helps the pancake cook evenly.',
      hint: 'Pinch the spatula and trace two smooth circles in the pan.',
      completion: 'stir',
      zone: 'pan',
      tool: 'spatula',
      turns: 2,
      guides: [{ held: 'spatula', target: 'pan' }],
      tools: ['pan', 'stove', 'spatula'],
      grabbableTools: ['spatula'],
      ingredients: AFTER_BUTTER,
      grabbableIngredients: [],
    },
    {
      id: 'cook',
      title: 'Cook',
      instruction: 'Wait until the card says Ready, then lift the pan.',
      tip: 'Tiny bubbles pop across the top when the underside is golden.',
      hint: 'Leave the pan on the burner until Ready, then lift it.',
      completion: 'cook',
      tools: ['pan', 'stove'],
      grabbableTools: ['pan'],
      ingredients: AFTER_BUTTER,
      grabbableIngredients: [],
    },
    {
      id: 'flip',
      title: 'Toss & flip',
      instruction: 'Flick your wrist up while holding the pan to flip it.',
      tip: 'A crisp upward flick turns the round pancake cleanly in mid-air.',
      hint: 'Hold the pan level and snap your wrist upward.',
      completion: 'flip',
      tools: ['pan', 'stove'],
      grabbableTools: ['pan'],
      ingredients: AFTER_BUTTER,
      grabbableIngredients: [],
    },
    {
      id: 'syrup',
      title: 'Drizzle syrup',
      instruction: 'Tip the maple syrup twice over the pan. Press Next when done.',
      tip: 'Warm maple syrup caramelizes lightly on the hot pancake top.',
      hint: 'Turn the syrup bottle upside down over the pan, then upright.',
      completion: 'season',
      zone: 'pan',
      item: 'syrup',
      guides: [{ held: 'syrup', target: 'pan' }],
      tools: ['pan', 'stove'],
      grabbableTools: [],
      ingredients: AFTER_BUTTER,
      grabbableIngredients: ['syrup'],
    },
    {
      id: 'finish',
      title: 'Finish',
      instruction: 'Set the pan on the stove until Golden, then lift it.',
      tip: 'A brief sear on the second side locks in the fluffy center.',
      hint: 'Rest the pan on the burner until Golden, then lift it.',
      completion: 'finish',
      guides: [{ held: 'pan', target: 'stove' }],
      tools: ['pan', 'stove', 'plate'],
      grabbableTools: ['pan'],
      ingredients: [],
      grabbableIngredients: [],
    },
    {
      id: 'plate',
      title: 'Serve',
      instruction: 'Carry the pan over the plate to slide the pancake out.',
      tip: 'Serve right away while the maple glaze is warm and glossy.',
      hint: 'Hold the pan right above the plate.',
      completion: 'plate',
      guides: [{ held: 'pan', target: 'plate' }],
      tools: ['pan', 'stove', 'plate'],
      grabbableTools: ['pan'],
      ingredients: [],
      grabbableIngredients: [],
    },
  ],
};

