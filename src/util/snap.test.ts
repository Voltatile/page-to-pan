import { describe, expect, it } from 'vitest';
import { isWithinSnapZone } from './snap.js';

describe('isWithinSnapZone', () => {
  const radius = 0.07;
  const height = 0.2;

  it('accepts an object right above the target', () => {
    expect(isWithinSnapZone(0, 0.1, 0, radius, height)).toBe(true);
  });

  it('accepts the exact radius', () => {
    expect(isWithinSnapZone(0.07, 0, 0, radius, height)).toBe(true);
  });

  it('measures radius across the sheet, not along one axis', () => {
    expect(isWithinSnapZone(0.06, 0, 0.06, radius, height)).toBe(false);
  });

  it('rejects an object too high above the sheet', () => {
    expect(isWithinSnapZone(0, 0.21, 0, radius, height)).toBe(false);
  });

  it('rejects an object far under the sheet', () => {
    expect(isWithinSnapZone(0, -0.21, 0, radius, height)).toBe(false);
  });
});
