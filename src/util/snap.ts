/**
 * True when a released object should snap to a target. Distance is measured
 * across the sheet, and height is only capped: players tend to let go above
 * the paper rather than press the object onto it. Arguments are offsets from
 * the target, which keeps this free of allocations in per-frame code.
 */
export function isWithinSnapZone(
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  radiusM: number,
  maxHeightM: number,
): boolean {
  if (offsetY < -maxHeightM || offsetY > maxHeightM) {
    return false;
  }
  return offsetX * offsetX + offsetZ * offsetZ <= radiusM * radiusM;
}
