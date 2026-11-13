import { describe, expect, it } from 'vitest';
import {
  CHEF_RANKS,
  nextRank,
  nextRankLine,
  rankFor,
  rankUpTitle,
} from './chef-rank.js';

describe('chef rank', () => {
  it('starts every player as a newcomer', () => {
    expect(rankFor(0).title).toBe('Kitchen Newcomer');
  });

  it('climbs with total stars and tops out at nine', () => {
    expect(rankFor(1).title).toBe('Kitchen Newcomer');
    expect(rankFor(2).title).toBe('Home Cook');
    expect(rankFor(5).title).toBe('Line Cook');
    expect(rankFor(8).title).toBe('Sous Chef');
    expect(rankFor(9).title).toBe('Head Chef');
  });

  it('keeps the ranks in order', () => {
    for (let index = 1; index < CHEF_RANKS.length; index += 1) {
      expect(CHEF_RANKS[index]?.minStars).toBeGreaterThan(
        CHEF_RANKS[index - 1]?.minStars ?? 0,
      );
    }
  });

  it('says how far the next rank is', () => {
    expect(nextRank(3)).toEqual({ rank: CHEF_RANKS[2], starsNeeded: 1 });
    expect(nextRank(9)).toBeNull();
    expect(nextRankLine(0)).toBe('2 more stars to Home Cook.');
    expect(nextRankLine(3)).toBe('1 more star to Line Cook.');
    expect(nextRankLine(9)).toBe('You are a Head Chef!');
  });

  it('names a rank up only when the rank changes', () => {
    expect(rankUpTitle(1, 2)).toBe('Home Cook');
    expect(rankUpTitle(2, 3)).toBeNull();
    expect(rankUpTitle(3, 3)).toBeNull();
    expect(rankUpTitle(5, 9)).toBe('Head Chef');
  });
});
