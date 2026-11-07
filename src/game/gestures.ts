import { smooth, wrapAngle } from '../util/smoothing.js';

/**
 * Gesture detectors. They hold plain numbers and take plain numbers, so they
 * allocate nothing per frame and can be unit tested without a headset. Real
 * hand tracking jitters, so anything built on positions or speeds smooths first.
 */

/** Both hands pinch near the egg, then pull apart. */
export class CrackDetector {
  private startSpreadM: number | null = null;

  /**
   * @param isPinching both hands are pinching right now.
   * @param isNearEgg both hands are close enough to the egg to begin.
   * @param spreadM current distance between the hands.
   * @returns true once the hands have pulled far enough apart.
   */
  update(
    isPinching: boolean,
    isNearEgg: boolean,
    spreadM: number,
    pullM: number,
  ): boolean {
    if (!isPinching) {
      this.startSpreadM = null;
      return false;
    }
    if (this.startSpreadM == null) {
      // Pulling apart leaves the egg behind, so nearness only gates the start.
      this.startSpreadM = isNearEgg ? spreadM : null;
      return false;
    }
    this.startSpreadM = Math.min(this.startSpreadM, spreadM);
    return spreadM - this.startSpreadM >= pullM;
  }

  reset(): void {
    this.startSpreadM = null;
  }
}

/** Adds up turns around the bowl center. Back-and-forth jitter cancels out. */
export class WhiskTracker {
  private x = 0;
  private z = 0;
  private lastAngle: number | null = null;
  private totalRad = 0;

  get turns(): number {
    return Math.abs(this.totalRad) / (Math.PI * 2);
  }

  /** Offsets are from the bowl center. Pass isInBowl false to pause counting. */
  update(
    offsetX: number,
    offsetZ: number,
    isInBowl: boolean,
    minRadiusM: number,
    alpha: number,
  ): number {
    if (!isInBowl) {
      this.lastAngle = null;
      return this.turns;
    }
    this.x = this.lastAngle == null ? offsetX : smooth(this.x, offsetX, alpha);
    this.z = this.lastAngle == null ? offsetZ : smooth(this.z, offsetZ, alpha);
    if (Math.hypot(this.x, this.z) < minRadiusM) {
      this.lastAngle = null;
      return this.turns;
    }
    const angle = Math.atan2(this.z, this.x);
    if (this.lastAngle != null) {
      this.totalRad += wrapAngle(angle - this.lastAngle);
    }
    this.lastAngle = angle;
    return this.turns;
  }

  reset(): void {
    this.lastAngle = null;
    this.totalRad = 0;
    this.x = 0;
    this.z = 0;
  }
}

/** Counts time spent tilted past the pour angle. Time survives a pause. */
export class PourTimer {
  private heldS = 0;

  update(
    tiltRad: number,
    isOverPan: boolean,
    minTiltRad: number,
    delta: number,
  ): number {
    if (isOverPan && tiltRad >= minTiltRad) {
      this.heldS += delta;
    }
    return this.heldS;
  }

  reset(): void {
    this.heldS = 0;
  }
}

/** Measures how fast a held object turns, from its orientation each frame. */
export class FlickDetector {
  private x = 0;
  private y = 0;
  private z = 0;
  private w = 1;
  private hasPrevious = false;
  private speedRadPerS = 0;

  /** Takes the quaternion parts and returns the smoothed angular speed. */
  update(
    x: number,
    y: number,
    z: number,
    w: number,
    delta: number,
    alpha: number,
  ): number {
    if (this.hasPrevious && delta > 0) {
      const dot = Math.abs(x * this.x + y * this.y + z * this.z + w * this.w);
      const angle = 2 * Math.acos(Math.min(dot, 1));
      this.speedRadPerS = smooth(this.speedRadPerS, angle / delta, alpha);
    }
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    this.hasPrevious = true;
    return this.speedRadPerS;
  }

  reset(): void {
    this.hasPrevious = false;
    this.speedRadPerS = 0;
  }
}
