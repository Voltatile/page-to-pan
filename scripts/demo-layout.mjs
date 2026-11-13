/** Where the bowl sits on the table, shared by the demo scripts. */
export const BOWL = { x: -0.27, z: -0.32 };
/** Where the stove, and the pan on it, sits on the table. */
export const STOVE = { x: 0.35, z: -0.35 };

/**
 * A stirring tool leans back toward the player and out to the side of the
 * holding hand, so the hand circles around a point nearer the player than the
 * food, at handle height. These match the lean in src/config/tuning.ts for a
 * seated head at the origin: the left hand whisks, the right hand stirs.
 */
export const WHISK_HAND = { x: -0.27, y: 1.07, z: -0.194 };
export const TURNER_HAND = { x: 0.334, y: 1.083, z: -0.167 };
