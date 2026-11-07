import { describe, expect, it } from 'vitest';
import { OMELETTE } from '../config/recipes/omelette.js';
import type { Recipe } from '../config/recipes/recipe.js';
import {
  completeStep,
  currentStep,
  type GameState,
  isPreparationComplete,
  isPreparationReady,
  requiredIngredientCount,
  startRecipe,
  TITLE_STATE,
} from './steps.js';

const REQUIRED = new Set(['egg', 'salt', 'butter']);
const EVERYTHING = new Set(['egg', 'salt', 'butter', 'green-onion']);

describe('recipe steps', () => {
  it('starts on the first step', () => {
    expect(startRecipe(OMELETTE)).toEqual({ phase: 'cooking', stepIndex: 0 });
  });

  it('finishes straight away for a recipe with no steps', () => {
    const empty: Recipe = { ...OMELETTE, steps: [] };
    expect(startRecipe(empty)).toEqual({ phase: 'done' });
  });

  it('walks every step in order and ends done', () => {
    let state: GameState = startRecipe(OMELETTE);
    const visited: (string | undefined)[] = [];
    while (state.phase === 'cooking') {
      visited.push(currentStep(state, OMELETTE)?.id);
      state = completeStep(state, OMELETTE);
    }
    expect(visited).toEqual(OMELETTE.steps.map((step) => step.id));
    expect(state).toEqual({ phase: 'done' });
  });

  it('ignores completion outside the cooking phase', () => {
    expect(completeStep(TITLE_STATE, OMELETTE)).toBe(TITLE_STATE);
    const done: GameState = { phase: 'done' };
    expect(completeStep(done, OMELETTE)).toBe(done);
  });

  it('has no current step outside cooking', () => {
    expect(currentStep(TITLE_STATE, OMELETTE)).toBeNull();
  });
});

describe('preparation', () => {
  it('counts only required ingredients', () => {
    expect(requiredIngredientCount(OMELETTE)).toBe(3);
  });

  it('is not ready while a required ingredient is missing', () => {
    expect(isPreparationReady(OMELETTE, new Set(['egg', 'salt']))).toBe(false);
  });

  it('is ready without the optional ingredient, but not complete', () => {
    expect(isPreparationReady(OMELETTE, REQUIRED)).toBe(true);
    expect(isPreparationComplete(OMELETTE, REQUIRED)).toBe(false);
  });

  it('is complete once everything is placed', () => {
    expect(isPreparationComplete(OMELETTE, EVERYTHING)).toBe(true);
  });
});

describe('optional steps', () => {
  const seasonIndex = OMELETTE.steps.findIndex(
    (step) => step.completion === 'season',
  );
  const atSeason: GameState = { phase: 'cooking', stepIndex: seasonIndex };

  it('runs the green onion step when it was set out', () => {
    const next = completeStep(atSeason, OMELETTE, new Set(['green-onion']));
    expect(currentStep(next, OMELETTE)?.completion).toBe('garnish');
  });

  it('skips the green onion step when it was left out', () => {
    const next = completeStep(atSeason, OMELETTE, new Set());
    expect(currentStep(next, OMELETTE)?.completion).toBe('heat');
  });
});
