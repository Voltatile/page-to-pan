import { describe, expect, it } from 'vitest';
import { loadBestStars, saveBestStars, type StarStorage } from './best-stars.js';

function memoryStorage(): StarStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const broken: StarStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('best stars', () => {
  it('starts at 0 and keeps the highest', () => {
    const storage = memoryStorage();
    expect(loadBestStars(storage, 'omelette')).toBe(0);
    expect(saveBestStars(storage, 'omelette', 2)).toBe(2);
    expect(saveBestStars(storage, 'omelette', 1)).toBe(2);
    expect(saveBestStars(storage, 'omelette', 3)).toBe(3);
    expect(loadBestStars(storage, 'omelette')).toBe(3);
  });

  it('ignores junk and survives blocked storage', () => {
    const storage = memoryStorage();
    storage.setItem('page-to-pan.best-stars.omelette', 'lots');
    expect(loadBestStars(storage, 'omelette')).toBe(0);
    expect(loadBestStars(broken, 'omelette')).toBe(0);
    expect(saveBestStars(broken, 'omelette', 2)).toBe(2);
    expect(loadBestStars(null, 'omelette')).toBe(0);
  });
});
