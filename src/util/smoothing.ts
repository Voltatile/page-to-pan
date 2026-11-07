/** Blends a noisy sample into a running value. `alpha` is the sample's weight. */
export function smooth(current: number, sample: number, alpha: number): number {
  return current + (sample - current) * alpha;
}

/** Smallest signed step between two angles in radians, in (-PI, PI]. */
export function wrapAngle(radians: number): number {
  const wrapped = (radians + Math.PI) % (Math.PI * 2);
  return (wrapped <= 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}
