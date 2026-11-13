/** The part of Web Storage this needs, so tests can pass a plain object. */
export interface StarStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const keyFor = (recipeId: string) => `page-to-pan.best-stars.${recipeId}`;

/** The browser's storage, or null where it is blocked. */
export function browserStorage(): StarStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Best stars so far for a recipe, 0 when there are none or storage fails. */
export function loadBestStars(
  storage: StarStorage | null,
  recipeId: string,
): number {
  try {
    const value = Number(storage?.getItem(keyFor(recipeId)) ?? 0);
    return Number.isInteger(value) && value >= 0 && value <= 3 ? value : 0;
  } catch {
    return 0;
  }
}

/** Keeps the higher of the stored and new stars. Returns the best. */
export function saveBestStars(
  storage: StarStorage | null,
  recipeId: string,
  stars: number,
): number {
  const best = Math.max(loadBestStars(storage, recipeId), stars);
  try {
    storage?.setItem(keyFor(recipeId), String(best));
  } catch {
    // Private browsing or a full disk: the best only lasts this session.
  }
  return best;
}

/** Best stars added up over every listed recipe. */
export function totalBestStars(
  storage: StarStorage | null,
  recipeIds: readonly string[],
): number {
  let total = 0;
  for (const recipeId of recipeIds) {
    total += loadBestStars(storage, recipeId);
  }
  return total;
}
