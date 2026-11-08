import { describe, expect, it } from 'vitest';
import { TITLE_PAGES } from './menu.js';

describe('title pages', () => {
  it('fit two card lines for the instruction and two for the tip', () => {
    for (const { instruction, tip } of Object.values(TITLE_PAGES)) {
      expect(instruction.length).toBeLessThanOrEqual(66);
      expect(tip.length).toBeLessThanOrEqual(70);
    }
  });
});
