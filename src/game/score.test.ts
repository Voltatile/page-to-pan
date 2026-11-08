import { describe, expect, it } from 'vitest';
import {
  accuracyScore,
  CHEF_NOTES,
  type CookRecord,
  crackScore,
  flipScore,
  scoreCook,
  starsFor,
  timingScore,
} from './score.js';

const PERFECT: CookRecord = {
  saltDashes: 2,
  servedProgress: 0.7,
  flipProgress: 0.4,
  crackOffset: 0,
  whiskTurns: 3,
};

describe('score parts', () => {
  it('takes a quarter of accuracy per dash of salt off', () => {
    expect(accuracyScore(2)).toBe(1);
    expect(accuracyScore(1)).toBe(0.75);
    expect(accuracyScore(4)).toBe(0.5);
    expect(accuracyScore(9)).toBe(0);
  });

  it('scores timing around the ideal doneness of 0.7', () => {
    expect(timingScore(0.7)).toBe(1);
    expect(timingScore(0.85)).toBeCloseTo(0.5);
    expect(timingScore(0.4)).toBeCloseTo(0);
    expect(timingScore(1.3)).toBe(0);
  });

  it('keeps half the crack credit at the rim', () => {
    expect(crackScore(0.2)).toBe(1);
    expect(crackScore(1)).toBeCloseTo(0.5);
  });

  it('costs technique for a late flip', () => {
    expect(flipScore(0.4)).toBe(1);
    expect(flipScore(0.7)).toBeCloseTo(0.5);
    expect(flipScore(1)).toBe(0);
  });

  it('turns totals into stars, never fewer than one', () => {
    expect(starsFor(85)).toBe(3);
    expect(starsFor(84)).toBe(2);
    expect(starsFor(60)).toBe(2);
    expect(starsFor(0)).toBe(1);
  });
});

describe('scoreCook', () => {
  it('uses a recipe note in place of the default', () => {
    const notes = { lessSalt: 'Go easy on the sweet soy.' };
    expect(scoreCook({ ...PERFECT, saltDashes: 5 }, 3, notes).note).toBe(
      'Go easy on the sweet soy.',
    );
    expect(scoreCook({ ...PERFECT, saltDashes: 0 }, 3, notes).note).toBe(
      CHEF_NOTES.moreSalt,
    );
  });

  it('gives a perfect cook 100 and praise', () => {
    const score = scoreCook(PERFECT, 3);
    expect(score.total).toBe(100);
    expect(score.stars).toBe(3);
    expect(score.note).toBe(CHEF_NOTES.praise);
  });

  it('advises on the weakest part', () => {
    expect(scoreCook({ ...PERFECT, saltDashes: 5 }, 3).note).toBe(
      CHEF_NOTES.lessSalt,
    );
    expect(scoreCook({ ...PERFECT, saltDashes: 0 }, 3).note).toBe(
      CHEF_NOTES.moreSalt,
    );
    expect(scoreCook({ ...PERFECT, servedProgress: 0.56 }, 3).note).toBe(
      CHEF_NOTES.cookLonger,
    );
    expect(scoreCook({ ...PERFECT, servedProgress: 0.95 }, 3).note).toBe(
      CHEF_NOTES.cookShorter,
    );
    expect(scoreCook({ ...PERFECT, flipProgress: 0.85 }, 3).note).toBe(
      CHEF_NOTES.flip,
    );
    expect(scoreCook(
        { ...PERFECT, crackOffset: 1, servedProgress: 0.66 },
        3,
      ).note).toBe(
      CHEF_NOTES.crack,
    );
  });

  it('weights accuracy and timing at 40 and technique at 20', () => {
    const score = scoreCook({ ...PERFECT, saltDashes: 0, flipProgress: 1 }, 3);
    expect(score.accuracy).toBe(0.5);
    expect(score.technique).toBeCloseTo(2 / 3);
    expect(score.total).toBe(Math.round(100 * (0.2 + 0.4 + 0.2 * (2 / 3))));
    expect(score.stars).toBe(2);
  });
});
