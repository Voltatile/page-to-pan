import {
  createSystem,
  type Entity,
  type Object3D,
  UIKit,
  UIKitMLAsset,
  Vector3,
  Visibility,
  VisibilityState,
} from '@iwsdk/core';
import { StepSystem } from './StepSystem.js';

const POP_IN_S = 0.3;
/** The note waits for the stars and the score before it appears. */
const DELAY_S = 1.2;
const OVERSHOOT = 1.7;

function easeOutBack(t: number): number {
  const u = t - 1;
  return 1 + (OVERSHOOT + 1) * u * u * u + OVERSHOOT * u * u;
}

/**
 * Once the dish is served, a note beside the plate tells the player how to
 * cook it in a real kitchen, so the lesson leaves the headset with them.
 */
export class HomeNoteSystem extends createSystem({}) {
  private steps!: StepSystem;
  private note!: Entity;
  private noteObject: Object3D | undefined;
  private text!: UIKit.Text;
  private baseScale = 1;
  /** Seconds since the dish was served, or -1 while the note is away. */
  private shownS = -1;
  private readonly headAt = new Vector3();

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('HomeNoteSystem needs StepSystem first');
    }
    this.steps = steps;
    this.note = this.world.requireSceneEntity('home-note');
    this.noteObject = this.note.object3D;
    this.baseScale = this.noteObject?.scale.x ?? 1;
    this.text = this.world
      .requireSceneObject<UIKitMLAsset>('home-note')
      .requireElementById<UIKit.Text>('home-note-text');
    this.note.setValue(Visibility, 'isVisible', false);
    this.cleanupFuncs.push(steps.subscribe(() => this.onStepChange()));
  }

  update(delta: number): void {
    const object = this.noteObject;
    if (
      this.shownS < 0 ||
      this.shownS >= DELAY_S + POP_IN_S ||
      object == null ||
      this.world.visibilityState.peek() !== VisibilityState.Visible
    ) {
      return;
    }
    const before = this.shownS;
    this.shownS += delta;
    if (this.shownS < DELAY_S) {
      return;
    }
    if (before < DELAY_S) {
      // Turn to the player once; a note that keeps turning is hard to read.
      this.player.head.getWorldPosition(this.headAt);
      object.lookAt(this.headAt);
      this.note.setValue(Visibility, 'isVisible', true);
    }
    const grow = easeOutBack(Math.min((this.shownS - DELAY_S) / POP_IN_S, 1));
    object.scale.setScalar(this.baseScale * Math.max(grow, 0.001));
  }

  private onStepChange(): void {
    const isDone = this.steps.state.phase === 'done';
    if (isDone && this.shownS < 0) {
      this.text.setProperties({ text: this.steps.activeRecipe.atHome });
      this.shownS = 0;
    } else if (!isDone && this.shownS >= 0) {
      this.shownS = -1;
      this.note.setValue(Visibility, 'isVisible', false);
    }
  }
}
