import { describe, expect, it } from 'vitest';
import type { StarStorage } from './best-stars.js';
import { loadHighContrast, saveHighContrast } from './contrast.js';

function memoryStorage(): StarStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('high contrast setting', () => {
  it('is off until turned on, and remembers the choice', () => {
    const storage = memoryStorage();
    expect(loadHighContrast(storage)).toBe(false);
    saveHighContrast(storage, true);
    expect(loadHighContrast(storage)).toBe(true);
    saveHighContrast(storage, false);
    expect(loadHighContrast(storage)).toBe(false);
  });

  it('stays off when storage is missing or blocked', () => {
    const blocked: StarStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadHighContrast(null)).toBe(false);
    expect(loadHighContrast(blocked)).toBe(false);
    expect(() => saveHighContrast(blocked, true)).not.toThrow();
  });
});
