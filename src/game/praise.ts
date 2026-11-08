import type { StepCompletion } from '../config/recipes/recipe.js';
import { COOK_ZONE } from './cooking.js';
import {
  accuracyScore,
  type CookRecord,
  crackScore,
  flipScore,
} from './score.js';

/** A part this good or better earns the top praise. */
const TOP_MARK = 0.95;

/**
 * A short cheer for the step just finished, shown floating over the table.
 * Good work gets a specific compliment; the rest still gets a kind word, so a
 * beginner never feels told off mid-recipe. Null means stay quiet.
 */
export function praiseFor(
  completion: StepCompletion,
  record: Readonly<CookRecord>,
  cookProgress: number,
): string | null {
  switch (completion) {
    case 'crack':
      return crackScore(record.crackOffset) >= TOP_MARK
        ? 'Clean crack!'
        : 'Cracked!';
    case 'whisk':
      return 'Nice and fluffy!';
    case 'season':
      return accuracyScore(record.saltDashes) >= TOP_MARK
        ? 'Just right!'
        : 'Seasoned!';
    case 'garnish':
      return 'Fresh!';
    case 'heat':
      return 'Sizzling!';
    case 'pour':
      return 'Smooth pour!';
    case 'flip':
      return flipScore(record.flipProgress) >= TOP_MARK
        ? 'Perfect flip!'
        : 'Flipped!';
    case 'finish':
      return cookProgress <= COOK_ZONE.burningAbove ? 'Golden!' : 'Crispy!';
    case 'plate':
      return 'Served!';
    case 'place-ingredients':
    case 'cook':
      return null;
  }
}
