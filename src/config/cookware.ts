import { TUNING } from './tuning.js';

/**
 * Real-size cookware dimensions in meters, shared by the models and the code
 * that seats them. Layout positions keep everything the player touches within
 * 60 cm of a seated chest, per the ergonomics rule.
 */
export const COOKWARE = {
  bowl: { rimRadius: 0.085, baseRadius: 0.05, height: 0.085 },
  pan: { rimRadius: 0.1, baseRadius: 0.09, height: 0.024, handleLength: 0.15 },
  stove: { width: 0.3, height: 0.03, grateHeight: 0.01 },
  plate: { radius: 0.1, height: 0.02, wellRadius: 0.05, wellDepth: 0.004 },
  omelette: { thickness: 0.014 },
  whisk: { length: 0.26 },
  spatula: { length: 0.28, bladeWidth: 0.065, bladeLength: 0.08 },
} as const;

/** Height of the whisk tip above the bowl center while it stirs. */
export const WHISK_TIP_IN_BOWL_Y = -COOKWARE.bowl.height / 2 + 0.01;

/** Small gap so the pan floor and the grate top never share a plane. */
const PAN_CLEARANCE_M = 0.003;

/** Where the pan rests on the grate while it heats. */
export const PAN_ON_STOVE_Y =
  TUNING.tableTopHeightM +
  COOKWARE.stove.height +
  COOKWARE.stove.grateHeight +
  PAN_CLEARANCE_M +
  COOKWARE.pan.height / 2;
