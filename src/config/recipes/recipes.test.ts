import { describe, expect, it } from 'vitest';
import { TUNING } from '../tuning.js';
import { ALL_RECIPES } from './index.js';

const TOOLS = ['bowl', 'whisk', 'spatula', 'pan', 'stove', 'plate'];

describe.each(ALL_RECIPES.map((recipe) => [recipe.id, recipe] as const))(
  'recipe %s',
  (_id, recipe) => {
    const ids = recipe.ingredients.map((ingredient) => ingredient.id);

    it('keeps every snap zone apart and every outline on the sheet', () => {
      const [width, depth] = recipe.sheetSizeM;
      recipe.ingredients.forEach((first, index) => {
        const [x, z] = first.sheetPosition;
        expect(Math.abs(x) + first.lengthM / 2).toBeLessThan(width / 2);
        expect(Math.abs(z) + first.widthM / 2).toBeLessThan(depth / 2);
        expect(first.lengthM).toBeGreaterThanOrEqual(0.04);
        for (const second of recipe.ingredients.slice(index + 1)) {
          const distance = Math.hypot(
            x - second.sheetPosition[0],
            z - second.sheetPosition[1],
          );
          expect(distance).toBeGreaterThan(TUNING.maxSnapRadiusM * 2);
        }
      });
    });

    it('only names its own ingredients and known tools', () => {
      for (const step of recipe.steps) {
        for (const id of step.ingredients) {
          expect(ids).toContain(id);
        }
        for (const id of step.grabbableIngredients) {
          expect(step.ingredients).toContain(id);
        }
        for (const tool of step.grabbableTools) {
          expect(step.tools).toContain(tool);
        }
        for (const guide of step.guides ?? []) {
          expect([...ids, ...TOOLS]).toContain(guide.held);
          expect(step.tools).toContain(guide.target);
        }
        if (step.item != null) {
          expect(ids).toContain(step.item);
        }
      }
    });

    it('fits its at-home note in four lines', () => {
      expect(recipe.atHome.length).toBeGreaterThan(20);
      expect(recipe.atHome.length).toBeLessThanOrEqual(92);
    });

    it('keeps tips and hints within two card lines', () => {
      for (const { tip, hint } of recipe.steps) {
        expect(tip.length).toBeLessThanOrEqual(70);
        expect(hint.length).toBeLessThanOrEqual(70);
      }
    });
  },
);
