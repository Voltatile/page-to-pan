import { TUNING } from './tuning.js';

/**
 * Real-size cookware dimensions in meters, shared by the models and the code
 * that seats them. Layout positions keep everything the player touches within
 * 60 cm of a seated chest, per the ergonomics rule.
 */
export const COOKWARE = {
  bowl: { rimRadius: 0.085, baseRadius: 0.05, height: 0.085 },
  pan: { rimRadius: 0.1, baseRadius: 0.09, height: 0.024, handleLength: 0.15 },
  stove: { width: 0.24, height: 0.03 },
  plate: { radius: 0.1, height: 0.012 },
  whisk: { length: 0.26 },
} as const;

/** Height of the whisk center above the bowl center when its head is in the bowl. */
export const WHISK_IN_BOWL_OFFSET_Y =
  COOKWARE.whisk.length / 2 - COOKWARE.bowl.height / 2 + 0.008;

/** Where the pan rests while it heats, measured from the table top. */
export const PAN_ON_STOVE_Y =
  TUNING.tableTopHeightM + COOKWARE.stove.height + COOKWARE.pan.height / 2;
