/** Doneness bands from the design brief. The ideal moment is 0.7. */
export const COOK_ZONE = { rawBelow: 0.55, burningAbove: 0.85, burntAbove: 1 };

/** The first side has set by here, so the omelette can be flipped. */
export const FLIP_READY_PROGRESS = 0.35;

/** Keeps a forgotten pan from counting up forever. */
const MAX_COOK_PROGRESS = 1.3;

export type CookZone = 'raw' | 'golden' | 'burning' | 'burnt';

export const COOK_ZONE_LABEL: Readonly<Record<CookZone, string>> = {
  raw: 'Raw',
  golden: 'Golden',
  burning: 'Burning',
  burnt: 'Burnt',
};

/** What the card says about the pan. The first side only waits for the flip. */
export function cookLabel(progress: number, isFlipped: boolean): string {
  const zone = cookZone(progress);
  const isBurning = zone === 'burning' || zone === 'burnt';
  if (!isFlipped && !isBurning && progress >= FLIP_READY_PROGRESS) {
    return 'Ready';
  }
  return COOK_ZONE_LABEL[zone];
}

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
