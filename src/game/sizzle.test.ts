import { describe, expect, it } from 'vitest';
import { type PanState, type Sizzle, sizzleOf } from './sizzle.js';

const COLD: PanState = {
  isOnHeat: false,
  hasButter: false,
  hasEgg: false,
  progress: 0,
  isTossing: false,
};

const read = (pan: Partial<PanState>): Sizzle =>
  sizzleOf({ ...COLD, ...pan }, { level: -1, burn: -1 });

describe('sizzleOf', () => {
  it('stays silent off the heat or with an empty pan', () => {
    expect(read({ hasEgg: true })).toEqual({ level: 0, burn: 0 });
    expect(read({ isOnHeat: true })).toEqual({ level: 0, burn: 0 });
  });

  it('sizzles butter softer than egg', () => {
    const butter = read({ isOnHeat: true, hasButter: true });
    const egg = read({ isOnHeat: true, hasEgg: true });
    expect(butter.level).toBeGreaterThan(0);
    expect(egg.level).toBeGreaterThan(butter.level);
  });

  it('grows louder and starts burning past the golden band', () => {
    const golden = read({ isOnHeat: true, hasEgg: true, progress: 0.7 });
    const burnt = read({ isOnHeat: true, hasEgg: true, progress: 1.2 });
    expect(golden.burn).toBe(0);
    expect(burnt.burn).toBe(1);
    expect(burnt.level).toBeGreaterThan(golden.level);
    expect(burnt.level).toBeLessThanOrEqual(1);
  });

  it('quiets down while the omelette is in the air', () => {
    const resting = read({ isOnHeat: true, hasEgg: true, progress: 0.5 });
    const tossing = read({
      isOnHeat: true,
      hasEgg: true,
      progress: 0.5,
      isTossing: true,
    });
    expect(tossing.level).toBeLessThan(resting.level);
  });
});
