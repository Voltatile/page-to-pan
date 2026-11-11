import { describe, expect, it } from 'vitest';
import { ALL_RECIPES, initialRecipe, RECIPES, sheetNodeId } from './index.js';
import { NASI_GORENG } from './nasi-goreng.js';
import { OMELETTE } from './omelette.js';
import { PANCAKE } from './pancake.js';

describe('recipe registry', () => {
  it('opens the first recipe by default', () => {
    expect(initialRecipe('')).toBe(RECIPES[0]);
    expect(initialRecipe('?recipe=unknown')).toBe(RECIPES[0]);
  });

  it('opens a recipe named in the address', () => {
    expect(initialRecipe('?recipe=omelette')).toBe(OMELETTE);
    expect(initialRecipe('?recipe=nasi-goreng')).toBe(NASI_GORENG);
    expect(initialRecipe('?recipe=pancake')).toBe(PANCAKE);
  });

  it('names one sheet node per recipe', () => {
    expect(sheetNodeId(OMELETTE)).toBe('recipe-sheet-omelette');
    const ids = ALL_RECIPES.map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
