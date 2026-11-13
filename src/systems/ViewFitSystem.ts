import {
  createSystem,
  type Object3D,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/** A gaze input can appear a little after the session starts. */
const GAZE_WAIT_S = 3;

/**
 * Fits the recipe card to the headset's view. A wide view shows the card at
 * eye level and the table together. A narrow one, such as Meta VR Glasses,
 * cannot, so there the card comes down and closer, just behind the recipe
 * sheet, where one downward look takes in both.
 *
 * Two signs mark a narrow view: the eye's own view angle, and a gaze input,
 * which only the glasses have. The emulator shows the second but not the
 * first, since it masks the picture instead of narrowing the camera.
 * QUEST-CHECK: only proven on the emulator's glasses profile. See
 * docs/quest-checklist.md.
 */
export class ViewFitSystem extends createSystem({}) {
  private stand: Object3D | undefined;
  private readonly wideAt = new Vector3();
  private readonly wideTurn = new Quaternion();
  private isFitted = false;
  /** Seconds in this XR session spent waiting for a sign of a narrow view. */
  private waitedS = 0;

  init(): void {
    this.stand = this.world.requireSceneEntity('recipe-stand').object3D;
    if (this.stand != null) {
      this.wideAt.copy(this.stand.position);
      this.wideTurn.copy(this.stand.quaternion);
    }
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.NonImmersive) {
          this.isFitted = false;
          this.waitedS = 0;
          this.stand?.position.copy(this.wideAt);
          this.stand?.quaternion.copy(this.wideTurn);
        }
      }),
    );
  }

  update(delta: number): void {
    const stand = this.stand;
    if (
      this.isFitted ||
      stand == null ||
      this.world.visibilityState.peek() === VisibilityState.NonImmersive
    ) {
      return;
    }
    const viewDeg = this.verticalViewDeg();
    if (viewDeg == null) {
      return;
    }
    this.waitedS += delta;
    if (viewDeg < TUNING.narrowViewBelowDeg || this.hasGazeInput()) {
      this.isFitted = true;
      stand.position.set(0, TUNING.narrowViewCardY, TUNING.narrowViewCardZ);
      stand.rotation.set(TUNING.narrowViewCardTiltDeg * DEG_TO_RAD, 0, 0);
    } else if (this.waitedS >= GAZE_WAIT_S) {
      this.isFitted = true;
    }
  }

  private hasGazeInput(): boolean {
    const sources = this.renderer.xr.getSession()?.inputSources;
    if (sources == null) {
      return false;
    }
    for (const source of sources) {
      if ((source.targetRayMode as string) === 'gaze') {
        return true;
      }
    }
    return false;
  }

  /** Up plus down angle of one eye's view, or null before the first XR frame. */
  private verticalViewDeg(): number | null {
    const xr = this.renderer.xr;
    if (!xr.isPresenting) {
      return null;
    }
    const eye = xr.getCamera().cameras[0];
    const scaleY = eye?.projectionMatrix.elements[5] ?? 0;
    const offsetY = eye?.projectionMatrix.elements[9] ?? 0;
    if (scaleY <= 0) {
      return null;
    }
    const up = Math.atan((1 + offsetY) / scaleY);
    const down = Math.atan((1 - offsetY) / scaleY);
    return (up + down) * RAD_TO_DEG;
  }
}
