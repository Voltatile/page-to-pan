/** Every gameplay tuning constant lives here. Distances are in meters. */
export const TUNING = {
  /**
   * Horizontal snap radius around a silhouette. Real hand tracking is shakier
   * than the emulator, so this stays in the generous 6-8 cm range.
   */
  snapRadiusM: 0.07,
  /** Largest allowed snap radius; silhouette spacing is designed around it. */
  maxSnapRadiusM: 0.08,
  /** Players let go above the sheet, so snapping forgives this much height. */
  snapMaxHeightM: 0.2,
  /** How fast a dropped ingredient glides home, as a fraction per second. */
  returnRatePerS: 10,
  /** A gliding ingredient lands once it is this close to home. */
  returnSettleM: 0.002,
  /** Glow on an object a pinch would catch right now. */
  reachGlowColor: '#FFB347',
  reachGlowIntensity: 0.45,
  /** Smoothing weight of each new sample in gesture detection. */
  gestureSmoothing: 0.35,
  /** Both hands must start this close to the egg to crack it. */
  crackReachM: 0.16,
  /** How far the hands must pull apart to crack the egg. */
  crackPullM: 0.08,
  /** The egg must be held this close over the bowl center to crack. */
  crackZoneRadiusM: 0.1,
  /** Inside the zone the whisk tip stays within this radius of the bowl center. */
  whiskHeadRadiusM: 0.026,
  /** While stirring, the whisk leans this far from upright, like a real one. */
  whiskMinTiltDeg: 20,
  whiskMaxTiltDeg: 28,
  /** The whisk leans toward a point this far beyond the hand, to its own side. */
  whiskLeanSideM: 0.09,
  whiskLeanTowardPlayerM: 0.08,
  /** How fast the held whisk settles into its pose, as a fraction per second. */
  whiskFollowRatePerS: 18,
  /** Outside the bowl, the whisk center hangs this far under the holding hand. */
  whiskUnderHandM: 0.08,
  /** The whisk counts anywhere inside this horizontal radius of the bowl. */
  bowlZoneRadiusM: 0.13,
  /** The whisk and a salting hand count up to this far above the bowl. */
  bowlZoneHeightM: 0.3,
  /** Circles tighter than this are treated as hand jitter. */
  whiskMinRadiusM: 0.015,
  whiskTargetTurns: 3,
  /** The shaker cap must be inside this horizontal radius of the bowl. */
  seasonZoneRadiusM: 0.12,
  /** Tipping the shaker past this tilt adds one dash of salt. */
  saltTipDeg: 95,
  /** The shaker must come back under this tilt before the next dash. */
  saltRearmDeg: 60,
  /** The butter lands in the pan when dropped inside this radius of it. */
  butterDropRadiusM: 0.13,
  butterDropHeightM: 0.25,
  butterMeltS: 3,
  /** The pan seats on the stove when released this close to it. */
  stoveSnapRadiusM: 0.12,
  /** The bowl counts as over the pan inside this radius of the stove. */
  pourZoneRadiusM: 0.24,
  pourMaxHeightM: 0.4,
  pourMinTiltDeg: 55,
  pourHoldS: 1.2,
  /** Seconds on the heat for cookProgress to go from 0 to 1. */
  cookDurationS: 25,
  /** Lifting the pan this far off the stove counts as taking it off the heat. */
  panLiftM: 0.05,
  /** How long the tossed omelette stays in the air. */
  tossDurationS: 1.4,
  /** How high the tossed omelette rises above the pan. */
  tossHeightM: 0.2,
  /** Smoothed pan turn speed that counts as a flick. */
  flickMinRadPerS: 6,
  /** The pan serves the omelette inside this radius of the plate. */
  plateZoneRadiusM: 0.16,
  plateZoneHeightM: 0.35,
  /** Table surface height above the virtual floor. */
  tableTopHeightM: 0.88,
  /** Seated calibration keeps the table this far under the player's head. */
  tableBelowHeadM: 0.72,
  /** Head poses under this height are treated as not tracked yet. */
  minTrackedHeadHeightM: 0.3,
} as const;
