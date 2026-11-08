import { describe, expect, it } from 'vitest';
import type { StarStorage } from './best-stars.js';
import { clampVolume, loadVolume, saveVolume, stepVolume } from './volume.js';

function memoryStorage(): StarStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('volume', () => {
  it('steps in tenths and stays within 0..1', () => {
    expect(stepVolume(0.9, 1)).toBeCloseTo(1);
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0.1, -1)).toBe(0);
    expect(stepVolume(0, -1)).toBe(0);
    expect(clampVolume(0.47)).toBeCloseTo(0.5);
  });

  it('remembers the saved volume', () => {
    const storage = memoryStorage();
    expect(loadVolume(storage, 0.9)).toBeCloseTo(0.9);
    saveVolume(storage, 0.3);
    expect(loadVolume(storage, 0.9)).toBeCloseTo(0.3);
  });

  it('falls back when storage is missing, broken or holds junk', () => {
    const broken: StarStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadVolume(null, 0.9)).toBeCloseTo(0.9);
    expect(loadVolume(broken, 0.9)).toBeCloseTo(0.9);
    expect(() => saveVolume(broken, 0.5)).not.toThrow();
    const junk = memoryStorage();
    junk.setItem('page-to-pan.volume', 'loud');
    expect(loadVolume(junk, 0.9)).toBeCloseTo(0.9);
  });
});
