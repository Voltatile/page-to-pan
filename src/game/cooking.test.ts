import { describe, expect, it } from 'vitest';
import { advanceCook, cookZone } from './cooking.js';

describe('cookZone', () => {
  it.each([
    [0, 'raw'],
    [0.54, 'raw'],
    [0.55, 'golden'],
    [0.7, 'golden'],
    [0.85, 'golden'],
    [0.86, 'burning'],
    [1, 'burning'],
    [1.01, 'burnt'],
  ])('reads %f as %s', (progress, zone) => {
    expect(cookZone(progress)).toBe(zone);
  });
});

describe('advanceCook', () => {
  it('rises linearly over the duration', () => {
    expect(advanceCook(0, 12.5, 25)).toBeCloseTo(0.5);
  });

  it('stops rising once burnt', () => {
    expect(advanceCook(1.29, 100, 25)).toBe(1.3);
  });
});
