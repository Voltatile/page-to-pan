import type { StarStorage } from './best-stars.js';

const CONTRAST_KEY = 'page-to-pan.high-contrast';

/** True when the player turned high contrast on in an earlier visit. */
export function loadHighContrast(storage: StarStorage | null): boolean {
  try {
    return storage?.getItem(CONTRAST_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveHighContrast(
  storage: StarStorage | null,
  isHigh: boolean,
): void {
  try {
    storage?.setItem(CONTRAST_KEY, isHigh ? '1' : '0');
  } catch {
    // Private browsing or a full disk: the choice only lasts this session.
  }
}
