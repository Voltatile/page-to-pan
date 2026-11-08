import type { StarStorage } from './best-stars.js';

const VOLUME_KEY = 'page-to-pan.volume';
/** The volume buttons move in tenths. */
export const VOLUME_STEP = 0.1;

/** Clamps to 0..1 and rounds to whole tenths, so the card shows clean numbers. */
export function clampVolume(volume: number): number {
  const tenths = Math.round(volume / VOLUME_STEP);
  return Math.min(Math.max(tenths * VOLUME_STEP, 0), 1);
}

/** One step up (+1) or down (-1) from `volume`. */
export function stepVolume(volume: number, direction: 1 | -1): number {
  return clampVolume(volume + direction * VOLUME_STEP);
}

/** The saved volume, or `fallback` when there is none or storage fails. */
export function loadVolume(
  storage: StarStorage | null,
  fallback: number,
): number {
  try {
    const saved = storage?.getItem(VOLUME_KEY);
    const value = saved == null ? Number.NaN : Number(saved);
    return Number.isFinite(value) ? clampVolume(value) : clampVolume(fallback);
  } catch {
    return clampVolume(fallback);
  }
}

export function saveVolume(storage: StarStorage | null, volume: number): void {
  try {
    storage?.setItem(VOLUME_KEY, String(clampVolume(volume)));
  } catch {
    // Blocked storage: the volume only lasts this session.
  }
}
