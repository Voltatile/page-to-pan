import {
  createSystem,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import { StepSystem } from './StepSystem.js';

type Hand = 'left' | 'right';
const HANDS: readonly Hand[] = ['left', 'right'];

const RING_SEGMENTS = 32;
const RING_INNER_M = 0.018;
const RING_OUTER_M = 0.026;
/** Triangles per ring segment times three indices. */
const INDICES_PER_SEGMENT = 6;

/**
 * The palm direction in each hand's grip space.
 * QUEST-CHECK: measured on the emulator's hands. See docs/quest-checklist.md.
 */
const PALM_AXIS: Readonly<Record<Hand, Vector3>> = {
  left: new Vector3(1, 0, 0),
  right: new Vector3(-1, 0, 0),
};

/**
 * Pauses the recipe two ways: a free hand held palm up in view fills a ring
 * and pauses when it is full, and the game pauses by itself when the headset
 * loses focus (system menu, headset off). The card then offers Resume.
 */
export class PauseSystem extends createSystem({}) {
  private readonly palm = new Vector3();
  private readonly handAt = new Vector3();
  private readonly headAt = new Vector3();
  private readonly gaze = new Vector3();
  private readonly toHand = new Vector3();
  private readonly turn = new Quaternion();
  private readonly ring = new Mesh(
    new RingGeometry(
      RING_INNER_M,
      RING_OUTER_M,
      RING_SEGMENTS,
      1,
      Math.PI / 2,
      Math.PI * 2,
    ),
    new MeshBasicMaterial({ color: TUNING.reachGlowColor, side: DoubleSide }),
  );
  private readonly track = new Mesh(
    new RingGeometry(RING_INNER_M, RING_OUTER_M, RING_SEGMENTS),
    new MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.35,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  private steps!: StepSystem;
  private heldS = 0;
  private palmHoldCount = 0;
  /** After a pause the palm must turn away before it can pause again. */
  private isArmed = true;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('PauseSystem needs StepSystem registered first');
    }
    this.steps = steps;
    this.ring.name = 'PauseRing';
    this.track.name = 'PauseRingTrack';
    this.ring.add(this.track);
    this.ring.visible = false;
    this.world.scene.add(this.ring);
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state !== VisibilityState.Visible) {
          this.steps.pauseGame();
        }
      }),
      () => this.ring.removeFromParent(),
    );
  }

  /** How many times a palm has filled the ring, also outside a recipe. */
  get palmHolds(): number {
    return this.palmHoldCount;
  }

  update(delta: number): void {
    const canPause =
      this.world.visibilityState.peek() === VisibilityState.Visible &&
      ((this.steps.state.phase === 'cooking' && !this.steps.isGamePaused) ||
        this.steps.wantsPalmPractice);
    const hand = canPause ? this.palmUpHand() : null;
    if (hand == null) {
      this.heldS = 0;
      this.isArmed = true;
      this.ring.visible = false;
      return;
    }
    if (!this.isArmed) {
      return;
    }
    this.heldS += delta;
    const progress = Math.min(this.heldS / TUNING.palmPauseHoldS, 1);
    this.showRing(progress);
    if (progress >= 1) {
      this.isArmed = false;
      this.ring.visible = false;
      this.palmHoldCount += 1;
      this.steps.pauseGame();
    }
  }

  /** A free, open hand turned palm up in front of the eyes. */
  private palmUpHand(): Hand | null {
    const head = this.player.head;
    head.getWorldPosition(this.headAt);
    head.getWorldQuaternion(this.turn);
    this.gaze.set(0, 0, -1).applyQuaternion(this.turn);
    for (const hand of HANDS) {
      if (this.input.xr.getSelectState(hand).active) {
        continue;
      }
      const grip = this.player.gripSpaces[hand];
      grip.getWorldPosition(this.handAt);
      grip.getWorldQuaternion(this.turn);
      this.palm.copy(PALM_AXIS[hand]).applyQuaternion(this.turn);
      this.toHand.subVectors(this.handAt, this.headAt).normalize();
      if (
        this.palm.y >= TUNING.palmUpMinDot &&
        this.toHand.dot(this.gaze) >= TUNING.palmInViewMinDot
      ) {
        return hand;
      }
    }
    return null;
  }

  /** The ring floats over the palm, faces the eyes, and fills as the hold goes on. */
  private showRing(progress: number): void {
    this.ring.visible = true;
    this.ring.position.copy(this.handAt);
    this.ring.position.y += TUNING.palmRingHeightM;
    this.ring.lookAt(this.headAt);
    this.ring.geometry.setDrawRange(
      0,
      Math.ceil(progress * RING_SEGMENTS) * INDICES_PER_SEGMENT,
    );
  }
}
