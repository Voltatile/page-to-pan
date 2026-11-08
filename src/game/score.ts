import { COOK_ZONE } from './cooking.js';

/** What the player did during one cook. Pure data, filled in by the systems. */
export interface CookRecord {
  /** Dashes of salt tipped into the bowl. */
  saltDashes: number;
  /** Doneness when the omelette went onto the plate. */
  servedProgress: number;
  /** Doneness of the first side when the omelette was flipped. */
  flipProgress: number;
  /** How far from the bowl center the egg cracked, 0 (middle) to 1 (rim). */
  crackOffset: number;
  /** Whisk turns, compared with the recipe target. */
  whiskTurns: number;
}

export type Stars = 1 | 2 | 3;

export interface CookScore {
  /** Each part runs from 0 to 1. */
  accuracy: number;
  timing: number;
  technique: number;
  /** 0 to 100. */
  total: number;
  stars: Stars;
  /** One short sentence of advice from the chef. */
  note: string;
}

/** Scoring rules from the design brief. */
export const SCORE_RULES = {
  idealSaltDashes: 2,
  /** Each dash away from the ideal costs this share of accuracy. */
  saltPenaltyPerDash: 0.25,
  idealProgress: 0.7,
  /** Timing reaches 0 this far from the ideal doneness. */
  progressTolerance: 0.3,
  /** Flipping after the first side leaves raw costs technique, down to 0 here. */
  flipLateFrom: COOK_ZONE.rawBelow,
  flipLateZeroAt: COOK_ZONE.burningAbove,
  /** A crack this close to the middle, as a share of the zone, is fully clean. */
  cleanCrackOffset: 0.4,
  /** A crack at the rim still keeps half the credit. */
  rimCrackCredit: 0.5,
  weights: { accuracy: 0.4, timing: 0.4, technique: 0.2 },
  threeStarsFrom: 85,
  twoStarsFrom: 60,
  /** Above this, the chef only has praise. */
  praiseFrom: 95,
} as const;

export const CHEF_NOTES = {
  praise: 'Perfect! Golden, soft, and seasoned just right.',
  moreSalt: 'Add a little more salt: two dashes is just right.',
  lessSalt: 'Go easy on the salt: two dashes is plenty.',
  cookLonger: 'Leave it on the heat a bit longer for a golden color.',
  cookShorter: 'Lift the pan a bit sooner, before it browns.',
  crack: 'Crack the egg right over the middle of the bowl.',
  flip: 'Flip as soon as the card says Ready.',
  whisk: 'Whisk a few more turns for a fluffy omelette.',
} as const;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function accuracyScore(saltDashes: number): number {
  const miss = Math.abs(saltDashes - SCORE_RULES.idealSaltDashes);
  return clamp01(1 - miss * SCORE_RULES.saltPenaltyPerDash);
}

/** 1 - |progress - 0.7| / 0.3, kept between 0 and 1. */
export function timingScore(servedProgress: number): number {
  const miss = Math.abs(servedProgress - SCORE_RULES.idealProgress);
  return clamp01(1 - miss / SCORE_RULES.progressTolerance);
}

export function crackScore(crackOffset: number): number {
  const { cleanCrackOffset, rimCrackCredit } = SCORE_RULES;
  const beyond = clamp01(
    (crackOffset - cleanCrackOffset) / (1 - cleanCrackOffset),
  );
  return 1 - beyond * (1 - rimCrackCredit);
}

export function flipScore(flipProgress: number): number {
  const { flipLateFrom, flipLateZeroAt } = SCORE_RULES;
  return clamp01(
    1 - (flipProgress - flipLateFrom) / (flipLateZeroAt - flipLateFrom),
  );
}

export function whiskScore(whiskTurns: number, targetTurns: number): number {
  return targetTurns <= 0 ? 1 : clamp01(whiskTurns / targetTurns);
}

export function starsFor(total: number): Stars {
  if (total >= SCORE_RULES.threeStarsFrom) {
    return 3;
  }
  return total >= SCORE_RULES.twoStarsFrom ? 2 : 1;
}

export function scoreCook(record: CookRecord, whiskTarget: number): CookScore {
  const accuracy = accuracyScore(record.saltDashes);
  const timing = timingScore(record.servedProgress);
  const crack = crackScore(record.crackOffset);
  const flip = flipScore(record.flipProgress);
  const whisk = whiskScore(record.whiskTurns, whiskTarget);
  const technique = (crack + flip + whisk) / 3;
  const { weights } = SCORE_RULES;
  const total = Math.round(
    100 *
      (weights.accuracy * accuracy +
        weights.timing * timing +
        weights.technique * technique),
  );
  return {
    accuracy,
    timing,
    technique,
    total,
    stars: starsFor(total),
    note: chefNote(record, { accuracy, timing, crack, flip, whisk }, total),
  };
}

/** Advice for the weakest part. Ties go to accuracy, then timing. */
function chefNote(
  record: CookRecord,
  parts: Record<'accuracy' | 'timing' | 'crack' | 'flip' | 'whisk', number>,
  total: number,
): string {
  if (total >= SCORE_RULES.praiseFrom) {
    return CHEF_NOTES.praise;
  }
  const technique = Math.min(parts.crack, parts.flip, parts.whisk);
  const weakest = Math.min(parts.accuracy, parts.timing, technique);
  if (parts.accuracy === weakest) {
    return record.saltDashes < SCORE_RULES.idealSaltDashes
      ? CHEF_NOTES.moreSalt
      : CHEF_NOTES.lessSalt;
  }
  if (parts.timing === weakest) {
    return record.servedProgress < SCORE_RULES.idealProgress
      ? CHEF_NOTES.cookLonger
      : CHEF_NOTES.cookShorter;
  }
  if (parts.flip === technique) {
    return CHEF_NOTES.flip;
  }
  return parts.crack === technique ? CHEF_NOTES.crack : CHEF_NOTES.whisk;
}
