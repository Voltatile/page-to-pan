import { COOK_ZONE } from './cooking.js';

/** What the pan is doing right now, as far as its sound and steam care. */
export interface PanState {
  isOnHeat: boolean;
  hasButter: boolean;
  hasEgg: boolean;
  /** Doneness from 0 up; past 1 it burns. */
  progress: number;
  isTossing: boolean;
}

/** How loud the pan sizzles and how close the food is to burning, 0 to 1. */
export interface Sizzle {
  level: number;
  burn: number;
}

/** Burning grows over this much doneness past the end of the golden band. */
const BURN_SPAN = 0.3;
const BUTTER_LEVEL = 0.45;
const EGG_LEVEL = 0.55;
const EGG_DONENESS_LEVEL = 0.25;
const BURN_LEVEL = 0.2;
/** In the air the omelette is off the metal, so the pan quiets down. */
const TOSSING_SCALE = 0.4;

/** Writes the sizzle of the pan into `out`, without allocating. */
export function sizzleOf(pan: PanState, out: Sizzle): Sizzle {
  out.level = 0;
  out.burn = 0;
  if (!pan.isOnHeat || (!pan.hasButter && !pan.hasEgg)) {
    return out;
  }
  if (!pan.hasEgg) {
    out.level = BUTTER_LEVEL;
    return out;
  }
  out.burn = Math.min(
    Math.max((pan.progress - COOK_ZONE.burningAbove) / BURN_SPAN, 0),
    1,
  );
  const level =
    EGG_LEVEL +
    EGG_DONENESS_LEVEL * Math.min(pan.progress, 1) +
    BURN_LEVEL * out.burn;
  out.level = Math.min(level * (pan.isTossing ? TOSSING_SCALE : 1), 1);
  return out;
}
