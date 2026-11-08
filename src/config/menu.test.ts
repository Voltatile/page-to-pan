import { describe, expect, it } from 'vitest';
import { PRACTICE_STAGES, TITLE_PAGES } from './menu.js';

describe('title pages', () => {
  it('fit two card lines for the instruction and two for the tip', () => {
    for (const { title, instruction, tip } of [
      ...Object.values(TITLE_PAGES),
      ...PRACTICE_STAGES,
    ]) {
      expect(title.length).toBeLessThanOrEqual(13);
      expect(instruction.length).toBeLessThanOrEqual(66);
      expect(tip.length).toBeLessThanOrEqual(70);
    }
  });
});
