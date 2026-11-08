import { describe, expect, it } from 'vitest';
import { initialRecipe, RECIPES, sheetNodeId } from './index.js';
import { OMELETTE } from './omelette.js';

describe('recipe registry', () => {
  it('opens the first recipe by default', () => {
    expect(initialRecipe('')).toBe(RECIPES[0]);
    expect(initialRecipe('?recipe=unknown')).toBe(RECIPES[0]);
  });

  it('opens a recipe named in the address', () => {
    expect(initialRecipe('?recipe=omelette')).toBe(OMELETTE);
  });

  it('names one sheet node per recipe', () => {
    expect(sheetNodeId(OMELETTE)).toBe('recipe-sheet-omelette');
    const ids = RECIPES.map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
