/** Doneness bands from the design brief. The ideal moment is 0.7. */
export const COOK_ZONE = { rawBelow: 0.55, burningAbove: 0.85, burntAbove: 1 };

/** Keeps a forgotten pan from counting up forever. */
const MAX_COOK_PROGRESS = 1.3;

export type CookZone = 'raw' | 'golden' | 'burning' | 'burnt';

export const COOK_ZONE_LABEL: Readonly<Record<CookZone, string>> = {
  raw: 'Raw',
  golden: 'Golden',
  burning: 'Burning',
  burnt: 'Burnt',
};

export function advanceCook(
  progress: number,
  delta: number,
  durationS: number,
): number {
  return Math.min(progress + delta / durationS, MAX_COOK_PROGRESS);
}

export function cookZone(progress: number): CookZone {
  if (progress < COOK_ZONE.rawBelow) {
    return 'raw';
  }
  if (progress <= COOK_ZONE.burningAbove) {
    return 'golden';
  }
  return progress <= COOK_ZONE.burntAbove ? 'burning' : 'burnt';
}
