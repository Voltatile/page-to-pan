import { describe, expect, it } from 'vitest';
import type { CookRecord } from './score.js';
import { praiseFor } from './praise.js';

const GOOD: CookRecord = {
  saltDashes: 2,
  servedProgress: 0.7,
  flipProgress: 0.4,
  crackOffset: 0.1,
  whiskTurns: 3,
};

describe('praiseFor', () => {
  it('compliments good work specifically', () => {
    expect(praiseFor('crack', GOOD, 0)).toBe('Clean crack!');
    expect(praiseFor('season', GOOD, 0)).toBe('Just right!');
    expect(praiseFor('flip', GOOD, 0.4)).toBe('Perfect flip!');
    expect(praiseFor('finish', GOOD, 0.7)).toBe('Golden!');
  });

  it('stays kind when the work was off', () => {
    const off = { ...GOOD, crackOffset: 1, saltDashes: 5, flipProgress: 0.8 };
    expect(praiseFor('crack', off, 0)).toBe('Cracked!');
    expect(praiseFor('season', off, 0)).toBe('Seasoned!');
    expect(praiseFor('flip', off, 0.8)).toBe('Flipped!');
    expect(praiseFor('finish', off, 0.95)).toBe('Crispy!');
  });

  it('stays quiet for setup and waiting steps', () => {
    expect(praiseFor('place-ingredients', GOOD, 0)).toBeNull();
    expect(praiseFor('cook', GOOD, 0.4)).toBeNull();
  });

  it('keeps every cheer short and plain ASCII for the card font', () => {
    const completions = [
      'crack',
      'whisk',
      'season',
      'garnish',
      'heat',
      'pour',
      'flip',
      'finish',
      'plate',
    ] as const;
    for (const completion of completions) {
      const text = praiseFor(completion, GOOD, 0.7) ?? '';
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(18);
      expect(/^[\x20-\x7E]+$/.test(text)).toBe(true);
    }
  });
});
