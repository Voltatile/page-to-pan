import { createSystem, VisibilityState } from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';

/**
 * Lifts the player rig once per XR session so the table sits the same distance
 * under the head whether the player is short, tall, seated, or standing. The
 * rig moves rather than the table, so the furniture stays on the floor.
 * QUEST-CHECK: only proven on the emulator. See docs/quest-checklist.md.
 */
export class SeatedCalibrationSystem extends createSystem({}) {
  private isCalibrated = false;

  init(): void {
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.NonImmersive) {
          this.isCalibrated = false;
          this.world.player.position.y = 0;
        }
      }),
    );
  }

  /** Fits the table to the head again, on the next tracked frame. */
  recalibrate(): void {
    this.isCalibrated = false;
  }

  update(): void {
    if (
      this.isCalibrated ||
      this.world.visibilityState.peek() === VisibilityState.NonImmersive
    ) {
      return;
    }
    const headHeight = this.world.player.head.position.y;
    if (headHeight < TUNING.minTrackedHeadHeightM) {
      return;
    }
    const targetHeadHeight = TUNING.tableTopHeightM + TUNING.tableBelowHeadM;
    this.world.player.position.y = targetHeadHeight - headHeight;
    this.isCalibrated = true;
  }
}
