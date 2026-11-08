import { describe, expect, it } from 'vitest';
import { TUNING } from '../tuning.js';
import { OMELETTE } from './omelette.js';

/** About two lines of 24-unit text on the 440-unit wide card. */
const CARD_LINE_LIMIT = 70;

describe('omelette recipe sheet', () => {
  const { ingredients, sheetSizeM } = OMELETTE;

  it('keeps every snap zone apart at the largest radius', () => {
    for (const [index, first] of ingredients.entries()) {
      for (const second of ingredients.slice(index + 1)) {
        const distance = Math.hypot(
          first.sheetPosition[0] - second.sheetPosition[0],
          first.sheetPosition[1] - second.sheetPosition[1],
        );
        expect(distance).toBeGreaterThan(TUNING.maxSnapRadiusM * 2);
      }
    }
  });

  it('keeps every outline on the sheet', () => {
    const [width, depth] = sheetSizeM;
    for (const { sheetPosition, lengthM, widthM } of ingredients) {
      expect(Math.abs(sheetPosition[0]) + lengthM / 2).toBeLessThan(width / 2);
      expect(Math.abs(sheetPosition[1]) + widthM / 2).toBeLessThan(depth / 2);
    }
  });

  it('keeps ingredients at least 4 cm long so hands can grab them', () => {
    for (const { lengthM } of ingredients) {
      expect(lengthM).toBeGreaterThanOrEqual(0.04);
    }
  });

  it('only unlocks ingredients that are on the table', () => {
    for (const step of OMELETTE.steps) {
      for (const id of step.grabbableIngredients) {
        expect(step.ingredients).toContain(id);
      }
    }
  });

  it('keeps tips and hints short enough for two card lines', () => {
    for (const { tip, hint } of OMELETTE.steps) {
      expect(tip.length).toBeLessThanOrEqual(CARD_LINE_LIMIT);
      expect(hint.length).toBeLessThanOrEqual(CARD_LINE_LIMIT);
    }
  });

  it('uses unique ids', () => {
    const ids = ingredients.map((ingredient) => ingredient.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
