import { describe, expect, it } from 'vitest';
import { smooth, wrapAngle } from './smoothing.js';

describe('smooth', () => {
  it('moves toward the sample by alpha', () => {
    expect(smooth(0, 10, 0.25)).toBe(2.5);
  });
});

describe('wrapAngle', () => {
  it('takes the short way around', () => {
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5);
  });
});
