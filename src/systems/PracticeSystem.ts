import { createSystem, type Entity, Grabbed } from '@iwsdk/core';
import { PauseSystem } from './PauseSystem.js';
import { SoundSystem } from './SoundSystem.js';
import { StepSystem } from './StepSystem.js';

/** Stages of the How to Play practice, in order. */
const GRAB_STAGE = 0;
const RELEASE_STAGE = 1;
const PALM_STAGE = 2;

/**
 * Watches the hands during the How to Play practice and moves it on as soon
 * as the player grabs the egg, lets it go, and holds a palm up.
 */
export class PracticeSystem extends createSystem({}) {
  private steps!: StepSystem;
  private pause!: PauseSystem;
  private sound: SoundSystem | undefined;
  private egg!: Entity;
  private palmHoldsAtStart = 0;
  private watchedStage = -1;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const pause = this.world.getSystem(PauseSystem);
    if (steps == null || pause == null) {
      throw new Error('PracticeSystem needs StepSystem and PauseSystem first');
    }
    this.steps = steps;
    this.pause = pause;
    this.sound = this.world.getSystem(SoundSystem);
    this.egg = this.world.requireSceneEntity('ingredient-egg');
  }

  update(): void {
    if (!this.steps.isPracticing) {
      this.watchedStage = -1;
      return;
    }
    const stage = this.steps.practiceStage;
    if (stage !== this.watchedStage) {
      this.watchedStage = stage;
      this.palmHoldsAtStart = this.pause.palmHolds;
    }
    const isHeld = this.egg.hasComponent(Grabbed);
    const isDone =
      (stage === GRAB_STAGE && isHeld) ||
      (stage === RELEASE_STAGE && !isHeld) ||
      (stage === PALM_STAGE && this.pause.palmHolds > this.palmHoldsAtStart);
    if (isDone) {
      this.steps.advancePractice();
      this.sound?.playSound('step', null);
    }
  }
}
