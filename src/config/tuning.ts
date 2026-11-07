/** Every gameplay tuning constant lives here. Distances are in meters. */
export const TUNING = {
  /**
   * Snap radius around a silhouette. Real hand tracking is shakier than the
   * emulator, so this stays in the generous 6-8 cm range.
   */
  snapRadiusM: 0.07,
  /** Largest allowed snap radius; silhouette spacing is designed around it. */
  maxSnapRadiusM: 0.08,
} as const;
