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
  /** Table surface height above the virtual floor. */
  tableTopHeightM: 0.88,
  /** Seated calibration keeps the table this far under the player's head. */
  tableBelowHeadM: 0.72,
  /** Head poses under this height are treated as not tracked yet. */
  minTrackedHeadHeightM: 0.3,
} as const;
